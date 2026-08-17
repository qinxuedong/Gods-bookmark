const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const bookmarkStreamClients = new Map();
const faviconCache = new Map();
const faviconInflightRequests = new Map();
const FAVICON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAVICON_FETCH_TIMEOUT_MS = 1500;
const FAVICON_MAX_PAGE_ICON_CANDIDATES = 4;
const FAVICON_CACHE_MAX_ENTRIES = 500;
// favicon 落盘目录与索引：服务重启后无需重新抓取
const FAVICON_DISK_DIR = path.join(__dirname, 'data', 'favicons');
const FAVICON_INDEX_PATH = path.join(FAVICON_DISK_DIR, 'index.json');
const faviconDiskIndex = new Map();
let faviconIndexWriteScheduled = false;
const DEFAULT_FAVICON_SVG = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#1f2937"/>
        <path d="M10 8h8.5a5.5 5.5 0 1 1 0 11H14v5h-4V8zm4 7h4.5a1.5 1.5 0 1 0 0-3H14v3z" fill="#f9fafb"/>
    </svg>`
);

// Middleware
// gzip/br 压缩（SSE 端点已带 no-transform，不受影响）
app.use(compression());
// 增加 JSON 请求体大小限制（处理大量书签数据）
app.use(bodyParser.json({ limit: '50mb' })); // 默认 100kb，增加到 50mb
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// ADMIN_PASSWORD 用于数据库初始化时创建默认 admin 用户（在 database.js 中使用）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin"; // Simple password - CHANGE IN PRODUCTION!

// ===== Session 管理函数 =====
const crypto = require('crypto');

function writeSseEvent(res, eventName, payload) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function addBookmarkStreamClient(userId, res) {
    const clientId = crypto.randomUUID();
    const clientInfo = {
        id: clientId,
        res
    };

    if (!bookmarkStreamClients.has(userId)) {
        bookmarkStreamClients.set(userId, new Map());
    }

    bookmarkStreamClients.get(userId).set(clientId, clientInfo);
    return clientId;
}

function removeBookmarkStreamClient(userId, clientId) {
    const userClients = bookmarkStreamClients.get(userId);
    if (!userClients) {
        return;
    }

    userClients.delete(clientId);
    if (userClients.size === 0) {
        bookmarkStreamClients.delete(userId);
    }
}

function broadcastBookmarkChange(userId, change) {
    const userClients = bookmarkStreamClients.get(userId);
    if (!userClients || userClients.size === 0) {
        return;
    }

    const payload = {
        ...change,
        timestamp: Date.now()
    };

    for (const client of userClients.values()) {
        try {
            writeSseEvent(client.res, 'bookmark-change', payload);
        } catch (error) {
            console.error('[BOOKMARK STREAM] Failed to push bookmark change:', error);
        }
    }
}

function normalizeBookmarkInsertIndex(index, itemsLength) {
    if (!Number.isInteger(index)) {
        return itemsLength;
    }

    return Math.max(0, Math.min(index, itemsLength));
}

function normalizeBookmarkMatchName(name) {
    return typeof name === 'string' ? name.trim() : '';
}

function normalizeBookmarkMatchUrl(url) {
    return typeof url === 'string' ? url.trim() : '';
}

function isSameBookmarkIdentity(left, right) {
    const leftUrl = normalizeBookmarkMatchUrl(left?.url);
    const rightUrl = normalizeBookmarkMatchUrl(right?.url);
    if (!leftUrl || !rightUrl || leftUrl !== rightUrl) {
        return false;
    }

    return normalizeBookmarkMatchName(left?.name) === normalizeBookmarkMatchName(right?.name);
}

function findBookmarkIndexByIdentity(items, bookmark, allowUrlFallback = true) {
    if (!Array.isArray(items) || !bookmark) {
        return -1;
    }

    const exactIndex = items.findIndex(item => isSameBookmarkIdentity(item, bookmark));
    if (exactIndex >= 0) {
        return exactIndex;
    }

    if (!allowUrlFallback) {
        return -1;
    }

    const targetUrl = normalizeBookmarkMatchUrl(bookmark.url);
    if (!targetUrl) {
        return -1;
    }

    return items.findIndex(item => normalizeBookmarkMatchUrl(item?.url) === targetUrl);
}

function removeBookmarkFromAllCategories(bookmarks, bookmark, options = {}) {
    const { removeAll = false, allowUrlFallback = true } = options;
    let removedCount = 0;

    for (const category of Array.isArray(bookmarks) ? bookmarks : []) {
        const items = Array.isArray(category?.items) ? category.items : [];
        let itemIndex = findBookmarkIndexByIdentity(items, bookmark, allowUrlFallback);

        while (itemIndex >= 0) {
            items.splice(itemIndex, 1);
            removedCount += 1;

            if (!removeAll) {
                return removedCount;
            }

            itemIndex = findBookmarkIndexByIdentity(items, bookmark, false);
        }
    }

    return removedCount;
}

// 创建 session
async function createSession(userId) {
    try {
        // 生成随机 session ID
        const sessionId = crypto.randomBytes(32).toString('hex');
        
        // 设置过期时间（7天）
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        // SQLite datetime 格式：YYYY-MM-DD HH:MM:SS
        const expiresAtStr = expiresAt.toISOString().replace('T', ' ').substring(0, 19);
        
        // 插入 session 到数据库
        await db.run(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
            [sessionId, userId, expiresAtStr]
        );
        
        console.log('[SESSION] Created session for user:', userId, 'expires at:', expiresAtStr);
        return sessionId;
    } catch (err) {
        console.error('[SESSION] Error creating session:', err);
        throw err;
    }
}

// 验证 session
async function validateSession(sessionId) {
    try {
        const session = await db.get(`
            SELECT 
                s.id as session_id,
                s.user_id,
                s.expires_at,
                u.id,
                u.username,
                u.role
            FROM sessions s
            INNER JOIN users u ON s.user_id = u.id
            WHERE s.id = ? AND s.expires_at > datetime('now')
        `, [sessionId]);
        
        return session || null;
    } catch (err) {
        console.error('[SESSION] Error validating session:', err);
        return null;
    }
}

// 删除 session
async function deleteSession(sessionId) {
    try {
        await db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
        console.log('[SESSION] Deleted session:', sessionId);
        return true;
    } catch (err) {
        console.error('[SESSION] Error deleting session:', err);
        return false;
    }
}

// 清理过期 session（可选）
async function cleanExpiredSessions() {
    try {
        const result = await db.run("DELETE FROM sessions WHERE expires_at <= datetime('now')");
        console.log('[SESSION] Cleaned expired sessions');
        return result;
    } catch (err) {
        console.error('[SESSION] Error cleaning expired sessions:', err);
        return null;
    }
}

// 从 session 获取用户ID（用于不需要 requireAuth 的接口）
async function getUserIdFromSession(req) {
    try {
        const sessionId = req.cookies['session_id'];
        if (!sessionId) {
            return null;
        }
        
        const session = await validateSession(sessionId);
        return session ? session.user_id : null;
    } catch (err) {
        console.error('[GET USER ID] Error getting user ID from session:', err);
        return null;
    }
}

// 多用户认证中间件 - 基于 sessions 表
async function requireAuth(req, res, next) {
    const sessionId = req.cookies['session_id'];

    if (!sessionId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // 从 sessions 表 JOIN users 表验证 session，并检查过期时间
        const session = await db.get(`
            SELECT 
                s.id as session_id,
                s.user_id,
                s.expires_at,
                u.id,
                u.username,
                u.role
            FROM sessions s
            INNER JOIN users u ON s.user_id = u.id
            WHERE s.id = ? AND s.expires_at > datetime('now')
        `, [sessionId]);

        if (session) {
            req.userId = session.user_id;
            req.user = {
                id: session.user_id,
                username: session.username,
                role: session.role
            };
            return next();
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (err) {
        console.error('[REQUIRE AUTH] Error validating session:', err);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

// 管理员权限检查
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
}

const ALLOWED_USER_ROLES = new Set(['admin', 'user']);
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 32;

function normalizeUsername(username) {
    return typeof username === 'string' ? username.trim() : '';
}

function parsePositiveInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validateUsername(username) {
    if (!username) {
        return 'Username is required';
    }
    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        return `Username must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters`;
    }
    if (/\s/.test(username)) {
        return 'Username cannot contain spaces';
    }
    return null;
}

function validatePassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        return 'Password is required';
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`;
    }
    return null;
}

function buildServerFaviconUrl(targetUrl) {
    if (!targetUrl) {
        return null;
    }
    return `/api/favicon?url=${encodeURIComponent(targetUrl)}`;
}

function isPrivateIpv4Hostname(hostname) {
    const parts = hostname.split('.').map(part => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
        return false;
    }

    if (parts[0] === 10 || parts[0] === 127) {
        return true;
    }
    if (parts[0] === 169 && parts[1] === 254) {
        return true;
    }
    if (parts[0] === 192 && parts[1] === 168) {
        return true;
    }
    return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function isDisallowedFaviconHostname(hostname) {
    if (!hostname) {
        return true;
    }

    const normalizedHostname = hostname.trim().toLowerCase();
    if (!normalizedHostname) {
        return true;
    }

    if (
        normalizedHostname === 'localhost' ||
        normalizedHostname === '0.0.0.0' ||
        normalizedHostname === '::1' ||
        normalizedHostname.endsWith('.local')
    ) {
        return true;
    }

    if (isPrivateIpv4Hostname(normalizedHostname)) {
        return true;
    }

    return normalizedHostname.startsWith('fe80:') ||
        normalizedHostname.startsWith('fc') ||
        normalizedHostname.startsWith('fd');
}

function isAllowedFaviconTarget(targetUrl) {
    try {
        const parsedUrl = new URL(targetUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return false;
        }
        return !isDisallowedFaviconHostname(parsedUrl.hostname);
    } catch (error) {
        return false;
    }
}

function getCachedFavicon(targetUrl) {
    const cached = faviconCache.get(targetUrl);
    if (!cached) {
        return null;
    }

    if (cached.expiresAt <= Date.now()) {
        faviconCache.delete(targetUrl);
        return null;
    }

    return cached;
}

function setCachedFavicon(targetUrl, result) {
    faviconCache.set(targetUrl, {
        ...result,
        expiresAt: Date.now() + FAVICON_CACHE_TTL_MS
    });

    // Map 保持插入顺序，超限时从最旧条目开始淘汰（近似 LRU）
    while (faviconCache.size > FAVICON_CACHE_MAX_ENTRIES) {
        const oldestKey = faviconCache.keys().next().value;
        if (oldestKey === undefined) {
            break;
        }
        faviconCache.delete(oldestKey);
    }
}

function initFaviconDiskCache() {
    fs.mkdirSync(FAVICON_DISK_DIR, { recursive: true });
    try {
        const rawIndex = JSON.parse(fs.readFileSync(FAVICON_INDEX_PATH, 'utf8'));
        for (const [url, entry] of Object.entries(rawIndex)) {
            if (entry && typeof entry.file === 'string' && entry.savedAt > 0) {
                faviconDiskIndex.set(url, entry);
            }
        }
    } catch (error) {
        // 首次运行或索引损坏，从空索引开始
    }
}

function scheduleFaviconIndexWrite() {
    if (faviconIndexWriteScheduled) {
        return;
    }
    faviconIndexWriteScheduled = true;
    setTimeout(() => {
        faviconIndexWriteScheduled = false;
        fs.writeFile(FAVICON_INDEX_PATH, JSON.stringify(Object.fromEntries(faviconDiskIndex)), (error) => {
            if (error) {
                console.warn('[FAVICON] 索引写入失败:', error.message);
            }
        });
    }, 1000);
}

function persistFaviconToDisk(targetUrl, result) {
    try {
        if (!result || !Buffer.isBuffer(result.body) || result.body.length === 0) {
            return;
        }

        let entry = faviconDiskIndex.get(targetUrl);
        if (!entry) {
            entry = {
                file: `${crypto.createHash('sha1').update(targetUrl).digest('hex')}.bin`,
                contentType: 'image/x-icon',
                savedAt: 0
            };
            faviconDiskIndex.set(targetUrl, entry);
        }

        entry.contentType = result.contentType || 'image/x-icon';
        const savedAt = Date.now();
        entry.savedAt = savedAt;

        fs.writeFile(path.join(FAVICON_DISK_DIR, entry.file), result.body, (error) => {
            if (error) {
                console.warn('[FAVICON] 图标写入磁盘失败:', targetUrl, error.message);
                faviconDiskIndex.delete(targetUrl);
                return;
            }
            scheduleFaviconIndexWrite();
        });
    } catch (error) {
        console.warn('[FAVICON] 图标落盘异常:', targetUrl, error.message);
    }
}

function readFaviconFromDisk(targetUrl) {
    return new Promise((resolve) => {
        const entry = faviconDiskIndex.get(targetUrl);
        // 磁盘条目同样遵循 24 小时 TTL，过期后重新抓取
        if (!entry || entry.savedAt + FAVICON_CACHE_TTL_MS <= Date.now()) {
            resolve(null);
            return;
        }

        fs.readFile(path.join(FAVICON_DISK_DIR, entry.file), (error, body) => {
            if (error || !body || body.length === 0) {
                resolve(null);
                return;
            }
            resolve({ body, contentType: entry.contentType });
        });
    });
}

function getDefaultFaviconPayload() {
    return {
        body: DEFAULT_FAVICON_SVG,
        contentType: 'image/svg+xml'
    };
}

function extractHtmlAttribute(tag, attributeName) {
    const pattern = new RegExp(`${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
    const match = tag.match(pattern);
    if (!match) {
        return '';
    }

    return match[2] || match[3] || match[4] || '';
}

function extractIconLinksFromHtml(html, baseUrl) {
    if (!html) {
        return [];
    }

    const iconUrls = [];
    const linkTags = html.match(/<link\b[^>]*>/gi) || [];

    linkTags.forEach(tag => {
        const rel = extractHtmlAttribute(tag, 'rel').toLowerCase();
        const href = extractHtmlAttribute(tag, 'href');
        if (!href || !rel.includes('icon')) {
            return;
        }

        try {
            iconUrls.push(new URL(href, baseUrl).toString());
        } catch (error) {
            // Ignore malformed icon links.
        }
    });

    return iconUrls;
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FAVICON_FETCH_TIMEOUT_MS);

    try {
        return await fetch(url, {
            redirect: 'follow',
            signal: controller.signal,
            ...options
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function resolveFaviconCandidates(targetUrl) {
    const parsedUrl = new URL(targetUrl);
    const candidates = [];
    let pageUrl = parsedUrl.toString();

    try {
        const response = await fetchWithTimeout(parsedUrl.toString(), {
            headers: {
                'User-Agent': 'GodsBookmark/1.0 favicon-fetcher',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        if (response.ok) {
            const finalUrl = response.url || parsedUrl.toString();
            if (isAllowedFaviconTarget(finalUrl)) {
                pageUrl = finalUrl;
                const contentType = (response.headers.get('content-type') || '').toLowerCase();
                if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
                    const html = await response.text();
                    candidates.push(...extractIconLinksFromHtml(html, finalUrl));
                }
            }
        }
    } catch (error) {
        console.warn('[FAVICON] Failed to resolve icon links from page:', targetUrl, error.message);
    }

    return [...new Set(candidates.filter(isAllowedFaviconTarget))].slice(0, FAVICON_MAX_PAGE_ICON_CANDIDATES);
}

async function fetchSingleFaviconCandidate(candidateUrl) {
    try {
        const response = await fetchWithTimeout(candidateUrl, {
            headers: {
                'User-Agent': 'GodsBookmark/1.0 favicon-fetcher',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });

        if (!response.ok || !isAllowedFaviconTarget(response.url || candidateUrl)) {
            return null;
        }

        const contentTypeHeader = (response.headers.get('content-type') || '').toLowerCase();
        if (
            contentTypeHeader &&
            !contentTypeHeader.startsWith('image/') &&
            !contentTypeHeader.includes('icon') &&
            !contentTypeHeader.includes('octet-stream')
        ) {
            return null;
        }

        const body = Buffer.from(await response.arrayBuffer());
        if (!body.length) {
            return null;
        }

        return {
            body,
            contentType: contentTypeHeader.split(';')[0] || 'image/x-icon'
        };
    } catch (error) {
        console.warn('[FAVICON] Failed to fetch candidate:', candidateUrl, error.message);
        return null;
    }
}

async function fetchFirstAvailableFavicon(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return null;
    }

    const tasks = candidates.map(async (candidateUrl) => {
        const result = await fetchSingleFaviconCandidate(candidateUrl);
        if (!result) {
            throw new Error(`favicon candidate failed: ${candidateUrl}`);
        }
        return result;
    });

    try {
        return await Promise.any(tasks);
    } catch (error) {
        return null;
    }
}

async function fetchFaviconPayload(targetUrl) {
    let quickCandidates = [];

    try {
        const pageOrigin = new URL(targetUrl).origin;
        quickCandidates = [
            new URL('/favicon.ico', pageOrigin).toString(),
            new URL('/apple-touch-icon.png', pageOrigin).toString()
        ].filter(isAllowedFaviconTarget);
    } catch (error) {
        // Ignore malformed origin.
    }

    const quickResult = await fetchFirstAvailableFavicon([...new Set(quickCandidates)]);
    if (quickResult) {
        return quickResult;
    }

    const pageCandidates = await resolveFaviconCandidates(targetUrl);
    const fallbackCandidates = pageCandidates.filter(candidate => !quickCandidates.includes(candidate));
    const fallbackResult = await fetchFirstAvailableFavicon(fallbackCandidates);
    if (fallbackResult) {
        return fallbackResult;
    }

    return getDefaultFaviconPayload();
}

async function getOrFetchFaviconPayload(targetUrl) {
    const inflight = faviconInflightRequests.get(targetUrl);
    if (inflight) {
        return inflight;
    };

    const requestPromise = (async () => {
        try {
            return await fetchFaviconPayload(targetUrl);
        } finally {
            faviconInflightRequests.delete(targetUrl);
        }
    })();

    faviconInflightRequests.set(targetUrl, requestPromise);
    return requestPromise;
}

function sendFaviconResponse(res, result) {
    res.setHeader('Content-Type', result.contentType || 'image/x-icon');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.body);
}

function validateRole(role) {
    if (!ALLOWED_USER_ROLES.has(role)) {
        return 'Invalid role';
    }
    return null;
}

// --- API Routes --- (必须在静态文件服务之前定义)

// 1. Auth

// ===== 多用户管理API =====

// 用户登录
app.post('/api/users/login', async (req, res) => {
    try {
        console.log('[USER LOGIN] ========== Login attempt received ==========');
        const username = normalizeUsername(req.body?.username);
        const password = req.body?.password;
        console.log('[USER LOGIN] Username:', username);
        console.log('[USER LOGIN] Password provided:', password ? 'yes' : 'no');
        
        if (!username || typeof password !== 'string' || password.length === 0) {
            console.log('[USER LOGIN] Missing username or password');
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const user = await db.get("SELECT id, username, password_hash, role FROM users WHERE username = ?", [username]);
        
        if (!user) {
            console.log('[USER LOGIN] User not found:', username);
            // 检查数据库中是否有任何用户
            const userCount = await db.get("SELECT COUNT(*) as count FROM users");
            console.log('[USER LOGIN] Total users in database:', userCount ? userCount.count : 0);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('[USER LOGIN] User found, checking password...');
        console.log('[USER LOGIN] User ID:', user.id, 'Role:', user.role);
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            console.log('[USER LOGIN] Invalid password for user:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('[USER LOGIN] Password valid, creating session...');
        
        // 创建 session
        const sessionId = await createSession(user.id);
        
        // 设置 session_id cookie
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = {
            httpOnly: true,
            maxAge: 86400000 * 7, // 7 days
            secure: isProduction,
            sameSite: 'lax',
            path: '/'
        };
        
        // 设置 session_id cookie
        res.cookie('session_id', sessionId, cookieOptions);
        
        // 清除旧的 cookie（如果存在）
        res.clearCookie('user_id', { path: '/' });
        res.clearCookie('auth_token', { path: '/' });
        
        console.log('[USER LOGIN] Session created:', sessionId);
        console.log('[USER LOGIN] Cookie options:', JSON.stringify(cookieOptions));
        
        console.log('[USER LOGIN] Login successful for user:', username, 'ID:', user.id);
        console.log('[USER LOGIN] ========== Login attempt completed ==========');
        res.json({ 
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (err) {
        console.error('[USER LOGIN] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 用户登出
app.post('/api/users/logout', async (req, res) => {
    try {
        const sessionId = req.cookies['session_id'];
        
        if (sessionId) {
            // 删除 sessions 表中的记录
            await deleteSession(sessionId);
            console.log('[USER LOGOUT] Session deleted:', sessionId);
        }
        
        // 清除 session_id cookie
        res.clearCookie('session_id', { path: '/' });
        
        // 清除旧的 cookie（如果存在）
        res.clearCookie('user_id', { path: '/' });
        res.clearCookie('auth_token', { path: '/' });
        
        console.log('[USER LOGOUT] Logout successful');
        res.json({ success: true });
    } catch (err) {
        console.error('[USER LOGOUT] Error:', err);
        // 即使删除失败，也清除 cookie
        res.clearCookie('session_id', { path: '/' });
        res.clearCookie('user_id', { path: '/' });
        res.clearCookie('auth_token', { path: '/' });
        res.json({ success: true });
    }
});

// 调试接口：检查数据库用户（仅用于调试，生产环境应删除）
app.get('/api/debug/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await db.all("SELECT id, username, role, created_at FROM users");
        const userCount = await db.get("SELECT COUNT(*) as count FROM users");
        const adminUser = await db.get("SELECT id, username, role FROM users WHERE username = ?", ['admin']);
        
        res.json({
            totalUsers: userCount ? userCount.count : 0,
            adminExists: !!adminUser,
            adminUser: adminUser,
            allUsers: users
        });
    } catch (err) {
        console.error('[DEBUG] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 检查用户认证状态
app.get('/api/users/check-auth', async (req, res) => {
    try {
        const sessionId = req.cookies['session_id'];
        
        console.log('[USER CHECK-AUTH] Session ID:', sessionId || 'none');
        
        let isLoggedIn = false;
        let user = null;
        
        if (sessionId) {
            // 验证 session
            const session = await validateSession(sessionId);
            
            if (session) {
                isLoggedIn = true;
                user = {
                    id: session.user_id,
                    username: session.username,
                    role: session.role
                };
                console.log('[USER CHECK-AUTH] User authenticated:', user.username);
            } else {
                console.log('[USER CHECK-AUTH] Session not found or expired');
            }
        } else {
            console.log('[USER CHECK-AUTH] No session_id cookie found');
        }
        
        res.json({ isLoggedIn, user });
    } catch (err) {
        console.error('[USER CHECK-AUTH] Error:', err);
        res.json({ isLoggedIn: false, user: null });
    }
});

// 获取用户列表（仅管理员）
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await db.all("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC");
        res.json({ success: true, users });
    } catch (err) {
        console.error('[GET USERS] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 创建用户（仅管理员）
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const username = normalizeUsername(req.body?.username);
        const password = req.body?.password;
        const role = req.body?.role || 'user';

        const usernameError = validateUsername(username);
        if (usernameError) {
            return res.status(400).json({ error: usernameError });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        const roleError = validateRole(role);
        if (roleError) {
            return res.status(400).json({ error: roleError });
        }
        
        // 检查用户名是否已存在
        const existingUser = await db.get("SELECT id FROM users WHERE username = ?", [username]);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // 加密密码
        const passwordHash = await bcrypt.hash(password, 10);
        
        // 创建用户
        const result = await db.run(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            [username, passwordHash, role]
        );
        
        res.json({
            success: true,
            user: {
                id: result.lastID,
                username,
                role
            }
        });
    } catch (err) {
        console.error('[CREATE USER] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 更新用户（管理员可以更新任何用户，普通用户只能更新自己的密码）
app.put('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const targetUserId = parsePositiveInteger(req.params.id);
        const currentUserId = req.userId || 0;
        const isAdmin = req.user && req.user.role === 'admin';
        const { username, password, role, oldPassword } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        
        // 权限检查：普通用户只能修改自己的密码，管理员可以修改任何用户
        if (!isAdmin && targetUserId !== currentUserId) {
            return res.status(403).json({ error: 'Forbidden: You can only update your own password' });
        }
        
        // 普通用户只能修改密码，不能修改用户名和角色
        if (!isAdmin) {
            if (username || role) {
                return res.status(403).json({ error: 'Forbidden: You can only update your password' });
            }
            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }
        }

        const targetUser = await db.get("SELECT id, password_hash FROM users WHERE id = ?", [targetUserId]);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isSelfPasswordChange = targetUserId === currentUserId && !!password;
        if (isSelfPasswordChange) {
            if (!oldPassword) {
                return res.status(400).json({ error: 'Current password is required' });
            }

            const isCurrentPasswordValid = await bcrypt.compare(oldPassword, targetUser.password_hash);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
        }
        
        let updateFields = [];
        let params = [];
        
        if (username && isAdmin) {
            const normalizedUsername = normalizeUsername(username);
            const usernameError = validateUsername(normalizedUsername);
            if (usernameError) {
                return res.status(400).json({ error: usernameError });
            }
            // 检查用户名是否已被其他用户使用
            const existingUser = await db.get("SELECT id FROM users WHERE username = ? AND id != ?", [normalizedUsername, targetUserId]);
            if (existingUser) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            updateFields.push("username = ?");
            params.push(normalizedUsername);
        }
        
        if (password) {
            const passwordError = validatePassword(password);
            if (passwordError) {
                return res.status(400).json({ error: passwordError });
            }
            const passwordHash = await bcrypt.hash(password, 10);
            updateFields.push("password_hash = ?");
            params.push(passwordHash);
        }
        
        if (role && isAdmin) {
            const roleError = validateRole(role);
            if (roleError) {
                return res.status(400).json({ error: roleError });
            }
            updateFields.push("role = ?");
            params.push(role);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        params.push(targetUserId);
        
        await db.run(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            params
        );
        
        console.log('[UPDATE USER] User updated:', targetUserId, 'by:', currentUserId, 'isAdmin:', isAdmin);
        res.json({ success: true });
    } catch (err) {
        console.error('[UPDATE USER] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 删除用户（仅管理员）
app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = parsePositiveInteger(req.params.id);

        if (!userId) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        
        // 不能删除自己
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        
        const result = await db.run("DELETE FROM users WHERE id = ?", [userId]);
        if (!result.changes) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE USER] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Bookmarks (支持多用户数据隔离)
// ===== 系统监控（真实数据） =====
// 后台每 2 秒采样一次 CPU 占用，避免每个请求都做延迟采样
let lastCpuTimes = os.cpus().map(cpu => cpu.times);
let lastCpuUsagePercent = 0;

setInterval(() => {
    const currentCpuTimes = os.cpus().map(cpu => cpu.times);
    let idleDelta = 0;
    let totalDelta = 0;

    currentCpuTimes.forEach((times, index) => {
        const previous = lastCpuTimes[index] || times;
        const idle = times.idle - previous.idle;
        const total = (times.user - previous.user) +
            (times.nice - previous.nice) +
            (times.sys - previous.sys) +
            (times.irq - previous.irq) +
            idle;
        idleDelta += idle;
        totalDelta += total;
    });

    if (totalDelta > 0) {
        lastCpuUsagePercent = Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
    }
    lastCpuTimes = currentCpuTimes;
}, 2000);

function getStorageUsage() {
    try {
        const stats = fs.statfsSync(path.join(__dirname, 'data'));
        const totalBytes = stats.blocks * stats.bsize;
        const freeBytes = stats.bfree * stats.bsize;
        if (totalBytes <= 0) {
            return null;
        }
        const usedBytes = totalBytes - freeBytes;
        return {
            percent: Math.max(0, Math.min(100, Math.round((usedBytes / totalBytes) * 100))),
            totalGB: Math.round((totalBytes / 1024 ** 3) * 10) / 10,
            usedGB: Math.round((usedBytes / 1024 ** 3) * 10) / 10
        };
    } catch (error) {
        // 运行环境不支持 statfs 时返回 null，前端显示 N/A
        return null;
    }
}

app.get('/api/system', requireAuth, (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    res.json({
        cpu: lastCpuUsagePercent,
        ram: {
            percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
            usedMB: Math.round(usedMem / 1024 ** 2),
            totalMB: Math.round(totalMem / 1024 ** 2)
        },
        storage: getStorageUsage()
    });
});

app.get('/api/favicon', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';

    if (!rawUrl || rawUrl.length > 2048 || !isAllowedFaviconTarget(rawUrl)) {
        return sendFaviconResponse(res, getDefaultFaviconPayload());
    }

    const cached = getCachedFavicon(rawUrl);
    if (cached) {
        return sendFaviconResponse(res, cached);
    }

    // 内存未命中时尝试磁盘缓存（服务重启后生效）
    const diskResult = await readFaviconFromDisk(rawUrl);
    if (diskResult) {
        setCachedFavicon(rawUrl, diskResult);
        return sendFaviconResponse(res, diskResult);
    }

    try {
        const result = await getOrFetchFaviconPayload(rawUrl);
        setCachedFavicon(rawUrl, result);
        persistFaviconToDisk(rawUrl, result);
        return sendFaviconResponse(res, result);
    } catch (error) {
        console.error('[FAVICON] Unhandled favicon fetch error:', rawUrl, error);
        return sendFaviconResponse(res, getDefaultFaviconPayload());
    }
});

app.get('/api/bookmarks', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        
        // 优先从user_data表获取
        try {
            const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'bookmarks'", [userId]);
            if (userRow) {
                return res.json(JSON.parse(userRow.value));
            }
        } catch (err) {
            // user_data表可能不存在，继续使用旧方式
        }
        
        // 向后兼容：从app_data表获取（仅当userId为0时，即旧的管理员账号）
        // 新用户不应该看到旧数据
        if (userId === 0) {
            const row = await db.get("SELECT value FROM app_data WHERE key = 'bookmarks'");
            res.json(JSON.parse(row ? row.value : '[]'));
        } else {
            // 新用户返回空数组
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookmarks', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        
        // 输入验证
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Invalid bookmarks format' });
        }
        
        // 保存到user_data表（多用户模式）
        try {
            await db.run(
                "INSERT OR REPLACE INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                [userId, 'bookmarks', JSON.stringify(req.body)]
            );
            broadcastBookmarkChange(userId, {
                type: 'bookmarks-replaced'
            });
            return res.json({ success: true });
        } catch (err) {
            // 如果user_data表不存在，使用旧方式
            if (err.message.includes('no such table')) {
                await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", ['bookmarks', JSON.stringify(req.body)]);
                broadcastBookmarkChange(userId, {
                    type: 'bookmarks-replaced'
                });
                return res.json({ success: true });
            }
            throw err;
        }
        
        await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", ['bookmarks', JSON.stringify(req.body)]);
        res.json({ success: true });
    } catch (err) {
        console.error('Save bookmarks error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bookmarks/stream', requireAuth, async (req, res) => {
    const userId = req.userId || 0;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const clientId = addBookmarkStreamClient(userId, res);
    writeSseEvent(res, 'connected', {
        success: true,
        userId,
        clientId,
        timestamp: Date.now()
    });

    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch (error) {
            clearInterval(heartbeat);
            removeBookmarkStreamClient(userId, clientId);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        removeBookmarkStreamClient(userId, clientId);
    });
});

// 5. Click Statistics API (支持多用户数据隔离)
app.post('/api/bookmark/click', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        const { url, name, icon } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // 从user_data表获取当前用户的统计数据
        let stats = {};
        try {
            const userStatsRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'click_stats'", [userId]);
            if (userStatsRow && userStatsRow.value) {
                stats = JSON.parse(userStatsRow.value);
            }
        } catch (err) {
            // user_data表可能不存在，使用旧方式（向后兼容）
            if (userId === 0) {
                const statsRow = await db.get("SELECT value FROM app_data WHERE key = 'click_stats'");
                if (statsRow && statsRow.value) {
                    stats = JSON.parse(statsRow.value);
                }
            }
        }

        // 更新点击次数（使用 URL 作为唯一标识）
        if (!stats[url]) {
            stats[url] = {
                url,
                name: name || '未知网站',
                icon: icon || '🔗',
                logo: null, // 存储favicon URL
                count: 0
            };
        }
        stats[url].count = (stats[url].count || 0) + 1;
        // 更新名称和图标（可能已更改）
        if (name) stats[url].name = name;
        if (icon) stats[url].icon = icon;
        
        // 如果没有logo，尝试生成favicon URL
        if (!stats[url].logo) {
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname;
                
                // 跳过本地URL（localhost、127.0.0.1、本地IP等）
                if (domain !== 'localhost' && 
                    domain !== '127.0.0.1' && 
                    !domain.startsWith('192.168.') && 
                    !domain.startsWith('10.') && 
                    !domain.startsWith('172.') &&
                    domain !== '0.0.0.0') {
                    stats[url].logo = buildServerFaviconUrl(url);
                }
            } catch (e) {
                // URL无效，忽略
            }
        }

        // 保存到user_data表（多用户模式）
        try {
            await db.run(
                "INSERT OR REPLACE INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                [userId, 'click_stats', JSON.stringify(stats)]
            );
        } catch (err) {
            // 如果user_data表不存在，使用旧方式（向后兼容）
            if (err.message.includes('no such table') && userId === 0) {
                await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", 
                    ['click_stats', JSON.stringify(stats)]);
            } else {
                throw err;
            }
        }
        
        res.json({ success: true, count: stats[url].count });
    } catch (err) {
        console.error('Save click stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. 书签同步API（用于浏览器扩展）
app.post('/api/bookmark/sync', requireAuth, async (req, res) => {
    try {
        const { category, bookmark, action } = req.body;
        const requestedIndex = Number.isInteger(req.body.index) ? req.body.index : null;
        
        if (!bookmark || !bookmark.url) {
            return res.status(400).json({ error: 'Invalid bookmark data' });
        }
        
        // 确定用户ID（优先使用请求中的userId，否则从session获取，最后默认为0）
        const targetUserId = req.userId;
        
        // 获取当前用户的书签数据（优先从user_data表）
        let bookmarks = [];
        try {
            const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'bookmarks'", [targetUserId]);
            if (userRow) {
                bookmarks = JSON.parse(userRow.value);
            }
        } catch (err) {
            // user_data表可能不存在，继续使用旧方式
        }
        
        // 向后兼容：如果user_data表没有数据且userId为0，从app_data表获取
        if (bookmarks.length === 0 && targetUserId === 0) {
            const row = await db.get("SELECT value FROM app_data WHERE key = 'bookmarks'");
            bookmarks = row ? JSON.parse(row.value) : [];
        }
        
        if (!Array.isArray(bookmarks)) {
            bookmarks = [];
        }
        
        const categoryName = category || '书签栏';
        
        if (action === 'created' || action === 'updated' || action === 'moved') {
            if (action === 'moved') {
                const removedCount = removeBookmarkFromAllCategories(bookmarks, bookmark, {
                    removeAll: true,
                    allowUrlFallback: true
                });
                console.log('[bookmark-sync] moved cleanup removed entries:', removedCount, bookmark.name, bookmark.url);
            }

            let categoryIndex = bookmarks.findIndex(cat => cat.category === categoryName);

            if (categoryIndex === -1) {
                bookmarks.push({
                    category: categoryName,
                    items: []
                });
                categoryIndex = bookmarks.length - 1;
            }

            const categoryItems = bookmarks[categoryIndex].items;
            let finalIndex = normalizeBookmarkInsertIndex(requestedIndex, categoryItems.length);

            if (action === 'created') {
                const existingCreatedIndex = findBookmarkIndexByIdentity(categoryItems, bookmark, false);
                if (existingCreatedIndex >= 0) {
                    console.log('[bookmark-sync] skip duplicate create in category:', categoryName, bookmark.name, bookmark.url);
                    return res.json({
                        success: true,
                        message: 'Bookmark already exists, skipped',
                        skipped: true,
                        category: categoryName
                    });
                }

                categoryItems.splice(finalIndex, 0, bookmark);
                console.log('[bookmark-sync] created bookmark:', bookmark.name, 'category:', categoryName, 'index:', finalIndex);
            } else if (action === 'updated') {
                const existingIndex = findBookmarkIndexByIdentity(categoryItems, bookmark, true);
                if (existingIndex >= 0) {
                    categoryItems[existingIndex] = {
                        ...categoryItems[existingIndex],
                        ...bookmark
                    };
                    finalIndex = existingIndex;
                } else {
                    categoryItems.splice(finalIndex, 0, bookmark);
                }
            } else {
                finalIndex = normalizeBookmarkInsertIndex(requestedIndex, categoryItems.length);
                categoryItems.splice(finalIndex, 0, bookmark);
                console.log('[bookmark-sync] moved bookmark:', bookmark.name, 'category:', categoryName, 'index:', finalIndex);
            }
            
            await db.run("INSERT OR REPLACE INTO user_data (user_id, key, value) VALUES (?, ?, ?)", 
                [targetUserId, 'bookmarks', JSON.stringify(bookmarks)]);
            
            // 向后兼容：如果userId为0，同时保存到app_data表
            if (targetUserId === 0) {
                await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", 
                    ['bookmarks', JSON.stringify(bookmarks)]);
            }
            
            broadcastBookmarkChange(targetUserId, {
                type: action === 'moved'
                    ? 'bookmark-moved'
                    : (action === 'updated' ? 'bookmark-updated' : 'bookmark-created'),
                category: categoryName,
                bookmark,
                index: finalIndex
            });

            res.json({ 
                success: true, 
                message: action === 'created' ? '书签已添加' : (action === 'moved' ? '书签已移动' : '书签已更新'),
                category: categoryName
            });
            
        } else if (action === 'removed') {
            // 删除书签（基于URL匹配）
            let removed = false;
            
            for (let i = 0; i < bookmarks.length; i++) {
                const category = bookmarks[i];
                const itemIndex = findBookmarkIndexByIdentity(category.items, bookmark, true);
                
                if (itemIndex >= 0) {
                    category.items.splice(itemIndex, 1);
                    removed = true;
                    console.log('[书签同步] 删除书签:', bookmark.url, '从分类:', category.category);
                    
                    // 如果分类为空，可选择删除分类（这里保留空分类）
                    break;
                }
            }
            
            if (removed) {
                // 保存书签到user_data表
                await db.run("INSERT OR REPLACE INTO user_data (user_id, key, value) VALUES (?, ?, ?)", 
                    [targetUserId, 'bookmarks', JSON.stringify(bookmarks)]);
                
                // 向后兼容：如果userId为0，同时保存到app_data表
                if (targetUserId === 0) {
                    await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", 
                        ['bookmarks', JSON.stringify(bookmarks)]);
                }
                
                broadcastBookmarkChange(targetUserId, {
                    type: 'bookmark-removed',
                    bookmark
                });

                res.json({ success: true, message: '书签已删除' });
            } else {
                res.json({ success: false, message: '未找到要删除的书签' });
            }
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
        
    } catch (err) {
        console.error('书签同步错误:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. 批量同步所有书签API（用于初始同步）
app.post('/api/bookmark/sync-all', requireAuth, async (req, res) => {
    try {
        const { bookmarks: bookmarksByCategory } = req.body;
        
        if (!bookmarksByCategory || typeof bookmarksByCategory !== 'object') {
            return res.status(400).json({ error: 'Invalid bookmarks data format' });
        }
        
        // 确定用户ID（优先使用请求中的userId，否则从session获取，最后默认为0）
        const targetUserId = req.userId;
        
        // 获取当前用户的书签数据（优先从user_data表）
        let existingBookmarks = [];
        try {
            const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'bookmarks'", [targetUserId]);
            if (userRow) {
                existingBookmarks = JSON.parse(userRow.value);
            }
        } catch (err) {
            // user_data表可能不存在，继续使用旧方式
        }
        
        // 向后兼容：如果user_data表没有数据且userId为0，从app_data表获取
        if (existingBookmarks.length === 0 && targetUserId === 0) {
            const row = await db.get("SELECT value FROM app_data WHERE key = 'bookmarks'");
            existingBookmarks = row ? JSON.parse(row.value) : [];
        }
        
        if (!Array.isArray(existingBookmarks)) {
            existingBookmarks = [];
        }
        
        // 统计信息
        const rebuiltBookmarks = Object.entries(bookmarksByCategory)
            .map(([categoryName, bookmarkList]) => ({
                category: categoryName || '书签栏',
                items: (Array.isArray(bookmarkList) ? bookmarkList : [])
                    .filter(bookmark => bookmark && bookmark.url)
                    .map(bookmark => ({ ...bookmark }))
            }))
            .filter(category => category.items.length > 0 || category.category);
        const previousCategoryCount = Array.isArray(existingBookmarks) ? existingBookmarks.length : 0;
        const previousBookmarkCount = Array.isArray(existingBookmarks)
            ? existingBookmarks.reduce((sum, category) => sum + (Array.isArray(category?.items) ? category.items.length : 0), 0)
            : 0;
        existingBookmarks = rebuiltBookmarks;
        const totalCategories = existingBookmarks.length;
        const totalBookmarks = existingBookmarks.reduce((sum, category) => sum + category.items.length, 0);
        const categoriesCreated = Math.max(0, totalCategories - previousCategoryCount);
        const totalAdded = Math.max(0, totalBookmarks - previousBookmarkCount);
        const totalUpdated = totalBookmarks;
        
        // 保存书签到user_data表
        await db.run("INSERT OR REPLACE INTO user_data (user_id, key, value) VALUES (?, ?, ?)", 
            [targetUserId, 'bookmarks', JSON.stringify(existingBookmarks)]);
        
        // 向后兼容：如果userId为0，同时保存到app_data表
        if (targetUserId === 0) {
            await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", 
                ['bookmarks', JSON.stringify(existingBookmarks)]);
        }
        
        const syncAllCategoryCount = totalCategories;
        const syncAllBookmarkCount = totalBookmarks;
        broadcastBookmarkChange(targetUserId, {
            type: 'bookmarks-replaced'
        });
        
        console.log(`[书签同步-批量] 用户 ${targetUserId} 同步完成: ${syncAllCategoryCount} 个分类, ${syncAllBookmarkCount} 个书签 (新增: ${totalAdded}, 更新: ${totalUpdated}, 新分类: ${categoriesCreated})`);
        
        res.json({ 
            success: true,
            message: '批量同步完成',
            stats: {
                categories: syncAllCategoryCount,
                categoriesCreated: categoriesCreated,
                totalBookmarks: syncAllBookmarkCount,
                added: totalAdded,
                updated: totalUpdated
            }
        });
        
    } catch (err) {
        console.error('批量书签同步错误:', err);
        res.status(500).json({ error: err.message });
    }
});

// 8. 同步文件夹操作API（用于浏览器扩展删除/创建文件夹）
app.post('/api/bookmark/sync-folder', requireAuth, async (req, res) => {
    try {
        const { action, folderName } = req.body;
        
        if (!folderName) {
            return res.status(400).json({ error: '文件夹名称不能为空' });
        }
        
        // 确定用户ID（优先使用请求中的userId，否则从session获取，最后默认为0）
        const targetUserId = req.userId;
        
        if (action === 'created') {
            // 创建文件夹时，在网站创建分类（可能包含书签）
            const { bookmarks: folderBookmarks = [] } = req.body;
            
            // 获取当前用户的书签数据（优先从user_data表）
            let bookmarks = [];
            try {
                const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'bookmarks'", [targetUserId]);
                if (userRow) {
                    bookmarks = JSON.parse(userRow.value);
                }
            } catch (err) {
                // user_data表可能不存在，继续使用旧方式
            }
            
            // 向后兼容：如果user_data表没有数据且userId为0，从app_data表获取
            if (bookmarks.length === 0 && targetUserId === 0) {
                const row = await db.get("SELECT value FROM app_data WHERE key = 'bookmarks'");
                bookmarks = row ? JSON.parse(row.value) : [];
            }
            
            // 检查分类是否已存在
            let categoryIndex = bookmarks.findIndex(cat => cat.category === folderName);
            
            if (categoryIndex === -1) {
                // 创建新分类（包含文件夹内的书签）
                bookmarks.push({
                    category: folderName,
                    items: Array.isArray(folderBookmarks) ? folderBookmarks : []
                });
                categoryIndex = bookmarks.length - 1;
            } else {
                // 如果分类已存在，合并书签（避免重复）
                const existingItems = bookmarks[categoryIndex].items;
                const existingUrls = new Set(existingItems.map(item => item.url));
                
                if (Array.isArray(folderBookmarks)) {
                    for (const bookmark of folderBookmarks) {
                        if (bookmark && bookmark.url && !existingUrls.has(bookmark.url)) {
                            existingItems.push(bookmark);
                        }
                    }
                }
            }
            
            // 保存书签到user_data表
            await db.run("INSERT OR REPLACE INTO user_data (user_id, key, value) VALUES (?, ?, ?)", 
                [targetUserId, 'bookmarks', JSON.stringify(bookmarks)]);
            
            // 向后兼容：如果userId为0，同时保存到app_data表
            if (targetUserId === 0) {
                await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", 
                    ['bookmarks', JSON.stringify(bookmarks)]);
            }
            
            console.log('[书签同步] 用户', targetUserId, '创建分类:', folderName, '包含', bookmarks[categoryIndex].items.length, '个书签');
            broadcastBookmarkChange(targetUserId, {
                type: 'folder-created',
                folderName,
                bookmarks: Array.isArray(folderBookmarks) ? folderBookmarks : []
            });

            res.json({ success: true, message: '分类已创建' });
        } else if (action === 'removed') {
            // 获取当前用户的书签数据（优先从user_data表）
            let bookmarks = [];
            try {
                const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'bookmarks'", [targetUserId]);
                if (userRow) {
                    bookmarks = JSON.parse(userRow.value);
                }
            } catch (err) {
                // user_data表可能不存在，继续使用旧方式
            }
            
            // 向后兼容：如果user_data表没有数据且userId为0，从app_data表获取
            if (bookmarks.length === 0 && targetUserId === 0) {
                const row = await db.get("SELECT value FROM app_data WHERE key = 'bookmarks'");
                bookmarks = row ? JSON.parse(row.value) : [];
            }
            
            if (!Array.isArray(bookmarks)) {
                bookmarks = [];
            }
            
            // 查找并删除分类
            const categoryIndex = bookmarks.findIndex(cat => cat.category === folderName);
            
            if (categoryIndex >= 0) {
                bookmarks.splice(categoryIndex, 1);
                
                // 保存书签到user_data表
                await db.run("INSERT OR REPLACE INTO user_data (user_id, key, value) VALUES (?, ?, ?)", 
                    [targetUserId, 'bookmarks', JSON.stringify(bookmarks)]);
                
                // 向后兼容：如果userId为0，同时保存到app_data表
                if (targetUserId === 0) {
                    await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", 
                        ['bookmarks', JSON.stringify(bookmarks)]);
                }
                
                console.log('[书签同步] 用户', targetUserId, '删除分类:', folderName);
                broadcastBookmarkChange(targetUserId, {
                    type: 'folder-removed',
                    folderName
                });

                res.json({ success: true, message: '分类已删除' });
            } else {
                res.json({ success: false, message: '未找到要删除的分类' });
            }
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
        
    } catch (err) {
        console.error('文件夹同步错误:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9. 检查书签是否存在API（用于同步前校验）
app.get('/api/bookmark/check-exists', requireAuth, async (req, res) => {
    try {
        const { category, url } = req.query;
        
        if (!category || !url) {
            return res.status(400).json({ error: '分类和URL参数不能为空' });
        }
        
        // 确定用户ID（优先使用请求中的userId，否则从session获取，最后默认为0）
        const targetUserId = req.userId;
        
        // 获取当前用户的书签数据（优先从user_data表）
        let bookmarks = [];
        try {
            const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'bookmarks'", [targetUserId]);
            if (userRow) {
                bookmarks = JSON.parse(userRow.value);
            }
        } catch (err) {
            // user_data表可能不存在，继续使用旧方式
        }
        
        // 向后兼容：如果user_data表没有数据且userId为0，从app_data表获取
        if (bookmarks.length === 0 && targetUserId === 0) {
            const row = await db.get("SELECT value FROM app_data WHERE key = 'bookmarks'");
            bookmarks = row ? JSON.parse(row.value) : [];
        }
        
        if (!Array.isArray(bookmarks)) {
            bookmarks = [];
        }
        
        // 查找指定分类
        const categoryObj = bookmarks.find(cat => cat.category === category);
        
        if (!categoryObj || !categoryObj.items) {
            return res.json({ exists: false });
        }
        
        // 检查分类中是否存在相同URL的书签
        const exists = categoryObj.items.some(item => item.url === url);
        
        res.json({ exists: exists });
        
    } catch (err) {
        console.error('检查书签是否存在错误:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. 获取所有书签API（用于浏览器扩展同步，不需要认证）
app.get('/api/bookmark/get-all', requireAuth, async (req, res) => {
    try {
        // 从查询参数或session获取userId
        const targetUserId = req.userId;
        
        // 优先从user_data表获取书签
        let bookmarks = [];
        try {
            const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'bookmarks'", [targetUserId]);
            if (userRow) {
                bookmarks = JSON.parse(userRow.value);
            }
        } catch (err) {
            // user_data表可能不存在，继续使用旧方式
        }
        
        // 向后兼容：如果user_data表没有数据且userId为0，从app_data表获取
        if (bookmarks.length === 0 && targetUserId === 0) {
            const row = await db.get("SELECT value FROM app_data WHERE key = 'bookmarks'");
            bookmarks = row ? JSON.parse(row.value) : [];
        }
        
        if (!Array.isArray(bookmarks)) {
            bookmarks = [];
        }
        
        console.log('[书签同步-API] 用户', targetUserId, '返回', bookmarks.length, '个分类的书签数据');
        res.json(bookmarks);
        
    } catch (err) {
        console.error('获取书签数据错误:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bookmark/top', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        const limit = parseInt(req.query.limit) || 10;
        
        // 从user_data表获取当前用户的统计数据
        let stats = {};
        try {
            const userStatsRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'click_stats'", [userId]);
            if (userStatsRow && userStatsRow.value) {
                stats = JSON.parse(userStatsRow.value);
            }
        } catch (err) {
            // user_data表可能不存在，使用旧方式（向后兼容）
            if (userId === 0) {
                const statsRow = await db.get("SELECT value FROM app_data WHERE key = 'click_stats'");
                if (statsRow && statsRow.value) {
                    stats = JSON.parse(statsRow.value);
                }
            }
        }

        // 转换为数组并排序
        const topBookmarks = Object.values(stats)
            .sort((a, b) => (b.count || 0) - (a.count || 0))
            .slice(0, limit);

        res.json({ topBookmarks });
    } catch (err) {
        console.error('Get top bookmarks error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 清除所有用户的Top10数据（仅管理员）
app.delete('/api/bookmark/top/all', requireAuth, requireAdmin, async (req, res) => {
    try {
        // 删除所有用户的click_stats数据
        await db.run("DELETE FROM user_data WHERE key = 'click_stats'");
        
        // 同时清除旧数据（app_data表中的click_stats，向后兼容）
        await db.run("DELETE FROM app_data WHERE key = 'click_stats'");
        
        console.log('[CLEAR TOP10] All users top10 data cleared');
        res.json({ success: true, message: 'All top10 data cleared successfully' });
    } catch (err) {
        console.error('[CLEAR TOP10] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Dashboard Config (支持多用户数据隔离)
app.get('/api/config', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        
        // 优先从user_data表获取
        try {
            const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'dashboard_config'", [userId]);
            if (userRow) {
                return res.json(JSON.parse(userRow.value));
            }
        } catch (err) {
            // user_data表可能不存在，继续使用旧方式
        }
        
        // 向后兼容：从app_data表获取（仅当userId为0时，即旧的管理员账号）
        // 新用户不应该看到旧数据
        if (userId === 0) {
            const row = await db.get("SELECT value FROM app_data WHERE key = 'dashboard_config'");
            const config = row ? JSON.parse(row.value) : {};
            // 确保有默认主题
            if (!config.theme) {
                config.theme = 'dark';
            }
            res.json(config);
        } else {
            // 新用户返回默认配置（包含暗色主题）
            res.json({ theme: 'dark' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        
        // 保存到user_data表（多用户模式）
        try {
            await db.run(
                "INSERT OR REPLACE INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                [userId, 'dashboard_config', JSON.stringify(req.body)]
            );
            return res.json({ success: true });
        } catch (err) {
            // 如果user_data表不存在，使用旧方式
            if (err.message.includes('no such table')) {
                await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", ['dashboard_config', JSON.stringify(req.body)]);
                return res.json({ success: true });
            }
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Todos API (支持多用户数据隔离)
app.get('/api/todos', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        console.log('[TODOS] Get request received for user:', userId);
        
        // 优先从user_data表获取
        try {
            const userRow = await db.get("SELECT value FROM user_data WHERE user_id = ? AND key = 'todos'", [userId]);
            if (userRow) {
                const todos = JSON.parse(userRow.value);
                console.log('[TODOS] Retrieved', todos.length, 'todos from user_data');
                return res.json(todos);
            }
        } catch (err) {
            // user_data表可能不存在，继续使用旧方式
            if (!err.message.includes('no such table')) {
                console.error('[TODOS] Error getting from user_data:', err);
            }
        }
        
        // 向后兼容：从app_data表获取（仅当userId为0时，即旧的管理员账号）
        // 新用户不应该看到旧数据
        if (userId === 0) {
            const row = await db.get("SELECT value FROM app_data WHERE key = 'todos'");
            const todos = row ? JSON.parse(row.value) : [];
            console.log('[TODOS] Retrieved', todos.length, 'todos from app_data (fallback)');
            res.json(todos);
        } else {
            // 新用户返回空数组
            console.log('[TODOS] New user, returning empty array');
            res.json([]);
        }
    } catch (err) {
        console.error('[TODOS] Get error:', err);
        console.error('[TODOS] Error stack:', err.stack);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

app.post('/api/todos', requireAuth, async (req, res) => {
    try {
        const userId = req.userId || 0;
        console.log('[TODOS] Save request received for user:', userId);
        console.log('[TODOS] Request body type:', typeof req.body);
        console.log('[TODOS] Request body is array:', Array.isArray(req.body));
        
        if (!Array.isArray(req.body)) {
            console.error('[TODOS] Invalid format: not an array');
            return res.status(400).json({ error: 'Invalid todos format: must be an array' });
        }
        
        const todosJson = JSON.stringify(req.body);
        console.log('[TODOS] Todos count:', req.body.length);
        console.log('[TODOS] Todos JSON length:', todosJson.length);
        
        // 保存到user_data表（多用户模式）
        try {
            await db.run(
                "INSERT OR REPLACE INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                [userId, 'todos', todosJson]
            );
            console.log('[TODOS] Saved to user_data table');
            return res.json({ success: true });
        } catch (err) {
            // 如果user_data表不存在，使用旧方式
            if (err.message.includes('no such table')) {
                await db.run("INSERT OR REPLACE INTO app_data (key, value) VALUES (?, ?)", ['todos', todosJson]);
                console.log('[TODOS] Saved to app_data table (fallback)');
                return res.json({ success: true });
            }
            throw err;
        }
        
    } catch (err) {
        console.error('[TODOS] Save error:', err);
        console.error('[TODOS] Error stack:', err.stack);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// ===== 备份管理API =====

// 获取备份配置列表
app.get('/api/backup/configs', requireAuth, async (req, res) => {
    try {
        const configs = await db.all(
            "SELECT id, backup_type, config, enabled, schedule, last_backup FROM backup_configs WHERE user_id = ? ORDER BY created_at DESC",
            [req.userId || 0]
        );
        
        const result = configs.map(c => ({
            id: c.id,
            backupType: c.backup_type,
            config: JSON.parse(c.config),
            enabled: c.enabled === 1,
            schedule: c.schedule,
            lastBackup: c.last_backup
        }));
        
        res.json({ success: true, configs: result });
    } catch (err) {
        console.error('[GET BACKUP CONFIGS] Error:', err);
        // 如果backup_configs表不存在，返回空数组
        if (err.message.includes('no such table')) {
            return res.json({ success: true, configs: [] });
        }
        res.status(500).json({ error: err.message });
    }
});

// 创建备份配置
app.post('/api/backup/configs', requireAuth, async (req, res) => {
    try {
        const { backupType, config, enabled = true, schedule } = req.body;
        
        if (!backupType || !config) {
            return res.status(400).json({ error: 'backupType and config required' });
        }
        
        // 普通用户不允许创建本地/NAS 类型备份（仅管理员支持）
        if (backupType === 'local' && (!req.user || req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'Only admin can create local/NAS backup' });
        }
        
        // 验证本地备份路径
        if (backupType === 'local' && config.path) {
            const backupPath = config.path.trim();
            if (!backupPath) {
                return res.status(400).json({ error: '备份路径不能为空' });
            }
            
            // 尝试解析路径
            const resolvedPath = path.isAbsolute(backupPath) 
                ? backupPath 
                : path.resolve(__dirname, backupPath);
            
            console.log('[CREATE BACKUP CONFIG] 备份路径:', resolvedPath);
            
            // 检查路径是否可访问（如果目录已存在）
            if (fs.existsSync(resolvedPath)) {
                try {
                    fs.accessSync(resolvedPath, fs.constants.W_OK);
                } catch (accessErr) {
                    console.error('[CREATE BACKUP CONFIG] 路径不可写:', accessErr.message);
                    return res.status(400).json({ 
                        error: `备份路径不可写: ${resolvedPath}。请检查目录权限。错误: ${accessErr.message}` 
                    });
                }
            } else {
                // 如果目录不存在，尝试创建（仅验证，不实际创建）
                try {
                    // 检查父目录是否存在且可写
                    const parentDir = path.dirname(resolvedPath);
                    if (fs.existsSync(parentDir)) {
                        fs.accessSync(parentDir, fs.constants.W_OK);
                    } else {
                        return res.status(400).json({ 
                            error: `备份路径的父目录不存在: ${parentDir}。请先创建目录。` 
                        });
                    }
                } catch (parentErr) {
                    console.error('[CREATE BACKUP CONFIG] 父目录检查失败:', parentErr.message);
                    return res.status(400).json({ 
                        error: `无法访问备份路径的父目录。请检查目录权限。错误: ${parentErr.message}` 
                    });
                }
            }
        }
        
        const result = await db.run(
            "INSERT INTO backup_configs (user_id, backup_type, config, enabled, schedule) VALUES (?, ?, ?, ?, ?)",
            [req.userId || 0, backupType, JSON.stringify(config), enabled ? 1 : 0, schedule || null]
        );
        
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        console.error('[CREATE BACKUP CONFIG] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 更新备份配置
app.put('/api/backup/configs/:id', requireAuth, async (req, res) => {
    try {
        const configId = req.params.id;
        const { backupType, config, enabled, schedule } = req.body;
        
        // 验证配置属于当前用户
        const existing = await db.get("SELECT user_id FROM backup_configs WHERE id = ?", [configId]);
        if (!existing || existing.user_id !== (req.userId || 0)) {
            return res.status(404).json({ error: 'Backup config not found' });
        }
        
        // 普通用户不允许将备份类型修改为本地/NAS（仅管理员支持）
        if (backupType === 'local' && (!req.user || req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'Only admin can use local/NAS backup' });
        }
        
        let updateFields = [];
        let params = [];
        
        if (backupType) {
            updateFields.push("backup_type = ?");
            params.push(backupType);
        }
        
        if (config) {
            updateFields.push("config = ?");
            params.push(JSON.stringify(config));
        }
        
        if (enabled !== undefined) {
            updateFields.push("enabled = ?");
            params.push(enabled ? 1 : 0);
        }
        
        if (schedule !== undefined) {
            updateFields.push("schedule = ?");
            params.push(schedule);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        params.push(configId);
        
        await db.run(
            `UPDATE backup_configs SET ${updateFields.join(', ')} WHERE id = ?`,
            params
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('[UPDATE BACKUP CONFIG] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 删除备份配置
app.delete('/api/backup/configs/:id', requireAuth, async (req, res) => {
    try {
        const configId = req.params.id;
        
        // 验证配置属于当前用户
        const existing = await db.get("SELECT user_id FROM backup_configs WHERE id = ?", [configId]);
        if (!existing || existing.user_id !== (req.userId || 0)) {
            return res.status(404).json({ error: 'Backup config not found' });
        }
        
        await db.run("DELETE FROM backup_configs WHERE id = ?", [configId]);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE BACKUP CONFIG] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 导入备份（从文件）- 必须在 /api/backup/run/:id 之前，避免路由冲突
app.post('/api/backup/import', requireAuth, async (req, res) => {
    console.log('[BACKUP IMPORT] Request received');
    try {
        const { backupData, importCategories } = req.body;
        
        if (!backupData || typeof backupData !== 'object') {
            console.log('[BACKUP IMPORT] Invalid backup data:', typeof backupData);
            return res.status(400).json({ error: 'Invalid backup data' });
        }
        
        console.log('[BACKUP IMPORT] Starting import for user:', req.userId || 0);
        console.log('[BACKUP IMPORT] Import categories:', importCategories);
        
        // 确定要导入的键
        let keysToImport = Object.keys(backupData);
        
        // 如果指定了导入分类，只导入对应的键
        if (importCategories && Array.isArray(importCategories) && importCategories.length > 0) {
            const categoryKeyMap = {
                'bookmarks': ['bookmarks'],
                'todos': ['todos'],
                'dashboard_config': Object.keys(backupData).filter(key => key !== 'bookmarks' && key !== 'todos')
            };
            
            keysToImport = [];
            importCategories.forEach(category => {
                if (categoryKeyMap[category]) {
                    keysToImport.push(...categoryKeyMap[category]);
                }
            });
            
            // 只保留备份文件中存在的键
            keysToImport = keysToImport.filter(key => backupData.hasOwnProperty(key));
            
            console.log('[BACKUP IMPORT] Filtered keys to import:', keysToImport);
        }
        
        if (keysToImport.length === 0) {
            return res.status(400).json({ error: 'No data to import' });
        }
        
        // 删除要导入的现有数据（只删除要导入的键）
        for (const key of keysToImport) {
            await db.run("DELETE FROM user_data WHERE user_id = ? AND key = ?", [req.userId || 0, key]);
        }
        
        // 恢复备份数据
        console.log('[BACKUP IMPORT] Restoring', keysToImport.length, 'data entries');
        
        for (const key of keysToImport) {
            const value = backupData[key];
            await db.run(
                "INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                [req.userId || 0, key, typeof value === 'string' ? value : JSON.stringify(value)]
            );
        }
        
        console.log('[BACKUP IMPORT] Imported backup successfully for user:', req.userId || 0);
        res.json({ 
            success: true, 
            message: 'Backup imported successfully',
            importedKeys: keysToImport,
            importedCount: keysToImport.length
        });
    } catch (err) {
        console.error('[BACKUP IMPORT] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 执行手动备份
app.post('/api/backup/run/:id', requireAuth, async (req, res) => {
    try {
        const configId = req.params.id;
        
        // 获取备份配置
        const backupConfig = await db.get(
            "SELECT * FROM backup_configs WHERE id = ? AND user_id = ?",
            [configId, req.userId || 0]
        );
        
        if (!backupConfig) {
            return res.status(404).json({ error: 'Backup config not found' });
        }
        
        if (!backupConfig.enabled) {
            return res.status(400).json({ error: 'Backup config is disabled' });
        }
        
        // 异步执行备份（不阻塞响应）
        executeBackup(backupConfig, req.userId || 0).catch(err => {
            console.error('[BACKUP] Error:', err);
        });
        
        res.json({ success: true, message: 'Backup started' });
    } catch (err) {
        console.error('[RUN BACKUP] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 获取备份历史
app.get('/api/backup/history', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = await db.all(
            "SELECT id, backup_config_id, backup_type, status, file_path, file_size, error_message, created_at FROM backup_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            [req.userId || 0, limit]
        );
        
        res.json({ success: true, history });
    } catch (err) {
        console.error('[GET BACKUP HISTORY] Error:', err);
        // 如果backup_history表不存在，返回空数组
        if (err.message.includes('no such table')) {
            return res.json({ success: true, history: [] });
        }
        res.status(500).json({ error: err.message });
    }
});

// 恢复备份
app.post('/api/backup/restore/:id', requireAuth, async (req, res) => {
    try {
        const backupId = req.params.id;
        
        // 获取备份记录
        const backupRecord = await db.get(
            "SELECT * FROM backup_history WHERE id = ? AND user_id = ?",
            [backupId, req.userId || 0]
        );
        
        if (!backupRecord) {
            return res.status(404).json({ error: 'Backup record not found' });
        }
        
        if (backupRecord.status !== 'success') {
            return res.status(400).json({ error: 'Cannot restore a failed backup' });
        }
        
        // 读取备份文件
        let backupData;
        const filePath = backupRecord.file_path;
        
        if (filePath && fs.existsSync(filePath)) {
            // 本地备份文件
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            backupData = JSON.parse(fileContent);
        } else {
            // 尝试从backups目录查找
            const fileName = filePath ? path.basename(filePath) : `backup_${req.userId || 0}_*.json`;
            const possiblePaths = [
                path.join(__dirname, 'backups', fileName),
                path.join(__dirname, 'backups', 'local', fileName)
            ];
            
            let found = false;
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    const fileContent = fs.readFileSync(possiblePath, 'utf-8');
                    backupData = JSON.parse(fileContent);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                return res.status(404).json({ error: 'Backup file not found' });
            }
        }
        
        // 恢复用户数据
        // 删除现有用户数据
        await db.run("DELETE FROM user_data WHERE user_id = ?", [req.userId || 0]);
        
        // 恢复备份数据
        for (const [key, value] of Object.entries(backupData)) {
            await db.run(
                "INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                [req.userId || 0, key, typeof value === 'string' ? value : JSON.stringify(value)]
            );
        }
        
        console.log('[BACKUP RESTORE] Restored backup for user:', req.userId || 0);
        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
        console.error('[BACKUP RESTORE] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 功能项映射
const BACKUP_CATEGORIES = {
    'bookmarks': '书签',
    'todos': '便签',
    'dashboard_config': '全局设置'
};

// 将书签数据转换为HTML格式
function bookmarksToHTML(bookmarksData) {
    let htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    // bookmarksData可能是对象 {bookmarks: [...]} 或直接是数组
    let bookmarks = null;
    if (bookmarksData && typeof bookmarksData === 'object') {
        if (Array.isArray(bookmarksData)) {
            bookmarks = bookmarksData;
        } else if (bookmarksData.bookmarks && Array.isArray(bookmarksData.bookmarks)) {
            bookmarks = bookmarksData.bookmarks;
        }
    }

    if (bookmarks && Array.isArray(bookmarks)) {
        bookmarks.forEach(category => {
            // 添加分类标题
            const categoryName = category.category || category.name || '未命名分类';
            htmlContent += `    <DT><H3 ADD_DATE="${Date.now()}" LAST_MODIFIED="${Date.now()}">${escapeHtml(categoryName)}</H3>\n`;
            htmlContent += `    <DL><p>\n`;
            
            // 添加该分类下的所有书签
            if (category.items && Array.isArray(category.items)) {
                category.items.forEach(item => {
                    const url = item.url || '#';
                    const name = item.name || 'Untitled';
                    const addDate = item.addDate || Date.now();
                    
                    htmlContent += `        <DT><A HREF="${escapeHtml(url)}" ADD_DATE="${addDate}">${escapeHtml(name)}</A></DT>\n`;
                });
            }
            
            htmlContent += `    </DL><p>\n`;
        });
    }

    htmlContent += `</DL><p>`;
    return htmlContent;
}

// HTML转义函数
function escapeHtml(text) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}


// 执行备份的内部函数
async function executeBackup(backupConfig, userId) {
    const config = JSON.parse(backupConfig.config);
    const backupType = backupConfig.backup_type;
    let status = 'success';
    let filePaths = [];
    let totalFileSize = 0;
    let errorMessage = null;
    
    try {
        // 获取用户名
        let username = 'admin';
        try {
            const user = await db.get("SELECT username FROM users WHERE id = ?", [userId]);
            if (user && user.username) {
                username = user.username;
            }
        } catch (err) {
            console.log('[BACKUP] 无法获取用户名，使用默认值:', err.message);
        }
        
        // 获取用户所有数据
        const userData = await getUserAllData(userId);
        
        // 创建时间戳
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        
        // 创建备份文件夹名称：backup_{用户名}_{时间戳}
        const backupFolderName = `backup_${username}_${timestamp}`;
        
        // 按功能项分类数据
        const categorizedData = {
            'bookmarks': {},
            'todos': {},
            'dashboard_config': {}
        };
        
        // 分类数据
        Object.keys(userData).forEach(key => {
            if (key === 'bookmarks') {
                categorizedData.bookmarks[key] = userData[key];
            } else if (key === 'todos') {
                categorizedData.todos[key] = userData[key];
            } else {
                // 其他键归入全局设置（包括 dashboard_config, click_stats 等）
                categorizedData.dashboard_config[key] = userData[key];
            }
        });
        
        // 为每个功能项创建备份文件
        for (const [categoryKey, categoryName] of Object.entries(BACKUP_CATEGORIES)) {
            const categoryData = categorizedData[categoryKey];
            
            // 如果该分类没有数据，跳过
            if (Object.keys(categoryData).length === 0) {
                console.log(`[BACKUP] 跳过空分类: ${categoryName}`);
                continue;
            }
            
            // 所有功能项都备份为JSON文件
            const jsonContent = JSON.stringify(categoryData, null, 2);
            let jsonFileName = null;
            
            if (categoryKey === 'bookmarks') {
                jsonFileName = 'bookmarks.json';
            } else if (categoryKey === 'todos') {
                jsonFileName = 'todos.json';
            } else {
                jsonFileName = 'settings.json';
            }
            
            // 备份JSON文件
            let jsonFilePath = null;
            if (backupType === 'local') {
                jsonFilePath = await backupToLocalWithFolder(
                    jsonContent, 
                    config.path || './backups', 
                    backupFolderName,
                    jsonFileName
                );
            } else {
                throw new Error(`不支持的备份类型: ${backupType}。仅支持本地备份。`);
            }
            
            if (jsonFilePath) {
                if (fs.existsSync(jsonFilePath)) {
                    const stats = fs.statSync(jsonFilePath);
                    totalFileSize += stats.size;
                }
                filePaths.push(jsonFilePath);
                console.log(`[BACKUP] ${categoryName} JSON备份完成: ${jsonFileName}`);
            }
            
            // 书签额外备份HTML文件
            if (categoryKey === 'bookmarks') {
                const bookmarksData = categoryData.bookmarks;
                const htmlContent = bookmarksToHTML(bookmarksData);
                const htmlFileName = 'bookmarks.html';
                
                let htmlFilePath = null;
                if (backupType === 'local') {
                    htmlFilePath = await backupToLocalWithFolder(
                        htmlContent, 
                        config.path || './backups', 
                        backupFolderName,
                        htmlFileName
                    );
                }
                
                if (htmlFilePath) {
                    if (fs.existsSync(htmlFilePath)) {
                        const stats = fs.statSync(htmlFilePath);
                        totalFileSize += stats.size;
                    }
                    filePaths.push(htmlFilePath);
                    console.log(`[BACKUP] ${categoryName} HTML备份完成: ${htmlFileName}`);
                }
            }
        }
        
        // 如果没有创建任何备份文件，记录警告
        if (filePaths.length === 0) {
            console.warn('[BACKUP] 没有数据需要备份');
        }
        
        // 更新最后备份时间
        await db.run(
            "UPDATE backup_configs SET last_backup = CURRENT_TIMESTAMP WHERE id = ?",
            [backupConfig.id]
        );
        
    } catch (err) {
        status = 'failed';
        errorMessage = err.message;
        console.error('[BACKUP] Error:', err);
    }
    
    // 记录备份历史（每个功能项单独记录）
    for (const filePath of filePaths) {
        let fileSize = 0;
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            fileSize = stats.size;
        }
        
        await db.run(
            "INSERT INTO backup_history (user_id, backup_config_id, backup_type, status, file_path, file_size, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [userId, backupConfig.id, backupType, status, filePath, fileSize, errorMessage]
        );
    }
    
    // 如果没有创建任何文件，至少记录一条历史
    if (filePaths.length === 0) {
        await db.run(
            "INSERT INTO backup_history (user_id, backup_config_id, backup_type, status, file_path, file_size, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [userId, backupConfig.id, backupType, status, null, 0, errorMessage || 'No data to backup']
        );
    }
}

// 获取用户所有数据
async function getUserAllData(userId) {
    try {
        // 获取用户的所有数据
        const userDataRows = await db.all(
            "SELECT key, value FROM user_data WHERE user_id = ?",
            [userId]
        );
        
        const userData = {};
        userDataRows.forEach(row => {
            try {
                userData[row.key] = JSON.parse(row.value);
            } catch (e) {
                userData[row.key] = row.value;
            }
        });
        
        return userData;
    } catch (err) {
        // 如果user_data表不存在，返回空数据
        if (err.message.includes('no such table')) {
            return {};
        }
        throw err;
    }
}

// 备份到本地/NAS（旧版本，保持兼容）
async function backupToLocal(data, backupPath, fileName) {
    // 确保备份目录存在
    if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
    }
    
    const filePath = path.join(backupPath, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    return filePath;
}

// 备份到本地/NAS（新版本，支持文件夹结构）
async function backupToLocalWithFolder(fileContent, backupPath, folderName, fileName) {
    try {
        // 解析路径（支持绝对路径和相对路径）
        const resolvedPath = path.isAbsolute(backupPath) 
            ? backupPath 
            : path.resolve(__dirname, backupPath);
        
        console.log('[BACKUP] 备份路径:', resolvedPath);
        console.log('[BACKUP] 备份文件夹:', folderName);
        console.log('[BACKUP] 文件名:', fileName);
        
        // 确保备份目录存在
        if (!fs.existsSync(resolvedPath)) {
            console.log('[BACKUP] 创建备份目录:', resolvedPath);
            try {
                fs.mkdirSync(resolvedPath, { recursive: true, mode: 0o755 });
                console.log('[BACKUP] 备份目录创建成功');
            } catch (mkdirErr) {
                console.error('[BACKUP] 创建备份目录失败:', mkdirErr.message);
                console.error('[BACKUP] 错误详情:', {
                    code: mkdirErr.code,
                    path: resolvedPath,
                    errno: mkdirErr.errno
                });
                throw new Error(`无法创建备份目录: ${resolvedPath}。错误: ${mkdirErr.message}。请检查目录权限。`);
            }
        } else {
            // 检查目录是否可写
            try {
                fs.accessSync(resolvedPath, fs.constants.W_OK);
            } catch (accessErr) {
                console.error('[BACKUP] 备份目录不可写:', accessErr.message);
                throw new Error(`备份目录不可写: ${resolvedPath}。请检查目录权限。`);
            }
        }
        
        // 创建备份文件夹
        const folderPath = path.join(resolvedPath, folderName);
        if (!fs.existsSync(folderPath)) {
            console.log('[BACKUP] 创建备份子文件夹:', folderPath);
            try {
                fs.mkdirSync(folderPath, { recursive: true, mode: 0o755 });
                console.log('[BACKUP] 备份子文件夹创建成功');
            } catch (mkdirErr) {
                console.error('[BACKUP] 创建备份子文件夹失败:', mkdirErr.message);
                throw new Error(`无法创建备份子文件夹: ${folderPath}。错误: ${mkdirErr.message}。请检查目录权限。`);
            }
        }
        
        // 写入文件
        const filePath = path.join(folderPath, fileName);
        console.log('[BACKUP] 写入备份文件:', filePath);
        try {
            fs.writeFileSync(filePath, fileContent, 'utf-8');
            console.log('[BACKUP] 备份文件写入成功:', filePath);
            
            // 验证文件是否成功写入
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                console.log('[BACKUP] 备份文件大小:', stats.size, 'bytes');
            } else {
                throw new Error('备份文件写入后验证失败');
            }
        } catch (writeErr) {
            console.error('[BACKUP] 写入备份文件失败:', writeErr.message);
            console.error('[BACKUP] 错误详情:', {
                code: writeErr.code,
                path: filePath,
                errno: writeErr.errno
            });
            throw new Error(`无法写入备份文件: ${filePath}。错误: ${writeErr.message}。请检查目录权限。`);
        }
        
        return filePath;
    } catch (error) {
        console.error('[BACKUP] 备份操作失败:', error);
        throw error;
    }
}


// 初始化定时备份任务
function initBackupScheduler() {
    // 每分钟检查一次是否有需要执行的备份任务
    cron.schedule('* * * * *', async () => {
        try {
            const backupConfigs = await db.all(
                "SELECT * FROM backup_configs WHERE enabled = 1 AND schedule IS NOT NULL"
            );
            
            for (const config of backupConfigs) {
                // 解析并检查 Cron 表达式
                const shouldRun = shouldRunBackup(config.schedule, config.last_backup);
                if (shouldRun) {
                    console.log(`[SCHEDULED BACKUP] Triggering backup for config ${config.id}, schedule: ${config.schedule}`);
                    executeBackup(config, config.user_id).catch(err => {
                        console.error('[SCHEDULED BACKUP] Error:', err);
                    });
                }
            }
        } catch (err) {
            // 如果backup_configs表不存在，忽略错误
            if (!err.message.includes('no such table')) {
                console.error('[BACKUP SCHEDULER] Error:', err);
            }
        }
    });
}

// 检查是否应该运行备份
function shouldRunBackup(schedule, lastBackup) {
    if (!schedule || !schedule.trim()) {
        return false;
    }
    
    // 验证 Cron 表达式格式
    if (!cron.validate(schedule)) {
        console.error('[BACKUP SCHEDULER] Invalid cron expression:', schedule);
        return false;
    }
    
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // JavaScript月份从0开始
    const currentWeekday = now.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // 解析 Cron 表达式
    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5) {
        console.error('[BACKUP SCHEDULER] Invalid cron format:', schedule);
        return false;
    }
    
    const [minuteExpr, hourExpr, dayExpr, monthExpr, weekdayExpr] = parts;
    
    // 检查分钟是否匹配
    if (!matchesCronField(minuteExpr, currentMinute, 0, 59)) {
        return false;
    }
    
    // 检查小时是否匹配
    if (!matchesCronField(hourExpr, currentHour, 0, 23)) {
        return false;
    }
    
    // 检查日期是否匹配
    if (!matchesCronField(dayExpr, currentDay, 1, 31)) {
        return false;
    }
    
    // 检查月份是否匹配
    if (!matchesCronField(monthExpr, currentMonth, 1, 12)) {
        return false;
    }
    
    // 检查星期是否匹配
    if (!matchesCronField(weekdayExpr, currentWeekday, 0, 6)) {
        return false;
    }
    
    // 如果所有字段都匹配，检查是否距离上次备份至少1分钟（避免重复执行）
    if (lastBackup) {
        const lastBackupTime = new Date(lastBackup).getTime();
        const minutesSinceLastBackup = (now.getTime() - lastBackupTime) / (1000 * 60);
        // 至少间隔1分钟，避免同一分钟内重复执行
        if (minutesSinceLastBackup < 1) {
            return false;
        }
    }
    
    return true;
}

// 辅助函数：检查值是否匹配 Cron 字段表达式
function matchesCronField(expr, value, min, max) {
    // 通配符：匹配所有值
    if (expr === '*') {
        return true;
    }
    
    // 列表：用逗号分隔的多个值
    if (expr.includes(',')) {
        const values = expr.split(',').map(v => parseInt(v.trim()));
        return values.includes(value);
    }
    
    // 范围：用连字符分隔的范围
    if (expr.includes('-')) {
        const [start, end] = expr.split('-').map(v => parseInt(v.trim()));
        return value >= start && value <= end;
    }
    
    // 步长：*/n 或 n/n
    if (expr.includes('/')) {
        const [base, step] = expr.split('/').map(v => v.trim());
        const stepValue = parseInt(step);
        
        if (base === '*') {
            // */n 表示每n个单位
            return value % stepValue === 0;
        } else {
            // n/n 表示从n开始，每step个单位
            const baseValue = parseInt(base);
            return value >= baseValue && (value - baseValue) % stepValue === 0;
        }
    }
    
    // 精确匹配
    return parseInt(expr) === value;
}

// 启动备份调度器
initBackupScheduler();

// 初始化 favicon 磁盘缓存（索引加载 + 目录创建）
initFaviconDiskCache();

// 静态文件服务（必须在所有API路由之后，避免拦截API请求）
// 设置CSP头（不允许eval和unsafe-inline脚本，但允许内联样式；字体已改为系统字体栈，不再依赖外部源）
app.use((req, res, next) => {
    // 只对HTML文件设置CSP
    if (req.path.endsWith('.html') || req.path === '/' || req.path === '') {
        res.setHeader('Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "font-src 'self' data:; " +
            "img-src 'self' data: https: http:; " +
            "connect-src 'self'; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';"
        );
    }
    next();
});

// 静态资源白名单：不再暴露整个项目根目录（data/、node_modules/、server.js 等包含敏感文件）
// HTML 不缓存（保证部署后立即生效），JS/CSS 缓存 1 小时并保留 ETag 协商
const sendHtmlFile = (fileName) => (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, fileName));
};

app.get('/', sendHtmlFile('index.html'));
app.get('/index.html', sendHtmlFile('index.html'));
app.get('/login.html', sendHtmlFile('login.html'));

// 浏览器默认请求的 favicon
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'extension', 'icon16.png'));
});

// 页面实际引用的根目录图片与文档
app.get('/Contro256.png', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'Contro256.png'));
});
app.get('/extension/icon16.png', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'extension', 'icon16.png'));
});
app.get('/BACKUP_CRON_GUIDE.md', sendHtmlFile('BACKUP_CRON_GUIDE.md'));

// 前端脚本与样式目录
app.use('/js', express.static(path.join(__dirname, 'js'), { maxAge: 3600000 }));
app.use('/css', express.static(path.join(__dirname, 'css'), { maxAge: 3600000 }));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: 3600000 }));

// 404 处理（捕获所有未匹配的路由）
app.use((req, res) => {
    // 只记录非静态资源的404
    if (!req.path.startsWith('/js/') && !req.path.startsWith('/css/') && !req.path.startsWith('/assets/')) {
        console.log(`[404] ${req.method} ${req.path}`);
    }
    // 如果是API请求，返回JSON格式的错误
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not Found', path: req.path, method: req.method });
    } else {
        // 静态文件404由浏览器处理
        res.status(404).send('Not Found');
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API routes available at /api/*`);
    console.log(`Todos API: GET /api/todos, POST /api/todos (requireAuth)`);
    console.log(`Bookmark Sync API: POST /api/bookmark/sync, POST /api/bookmark/sync-all`);
});
