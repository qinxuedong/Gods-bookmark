/**
 * 首屏启动链路回归测试
 *
 * 覆盖范围（第二轮首屏优化，见 RESEARCH_REPORT_2026-08-17.md 第七节）：
 * 1. DataManager 配置缓存与并发去重（/api/config 单飞）
 * 2. DataManager 书签缓存：并发去重、TTL、保存/手动失效
 * 3. 认证请求单飞：UserManager.checkAuth 并发去重；DataManager.isLoggedIn 复用 UserManager
 * 4. loadBookmarks 认证门：未登录不请求私有数据、清空容器；登录后正常渲染
 * 5. 农历算法（标准 1900-2100 历法）已知日期对照
 *
 * 全部在 vm 沙箱中加载真实前端脚本 + mock fetch，不访问网络、不触碰数据库。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    };
}

/**
 * 创建 vm 沙箱：注入 window/console/document 桩与可编程 fetch。
 * routes: Array<{ match: (url) => boolean, respond: (url) => ResponseLike }>
 */
function createSandbox({ routes = [] } = {}) {
    const fetchLog = [];

    const fetchImpl = async (url, options = {}) => {
        const method = (options && options.method) || 'GET';
        const entry = `${method} ${url}`;
        fetchLog.push(entry);
        const route = routes.find((r) => r.match(String(url), method));
        if (!route) {
            return jsonResponse(404, { error: 'Not Found' });
        }
        return route.respond(String(url));
    };

    const sandbox = {
        window: {
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {},
            matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
            innerWidth: 1024,
            innerHeight: 768,
            location: { pathname: '/index.html', search: '', hash: '' },
            requestIdleCallback: undefined,
            cancelIdleCallback: undefined,
            requestAnimationFrame: () => 0,
            cancelAnimationFrame() {},
            getComputedStyle: () => ({ getPropertyValue: () => '' })
        },
        console: { log() {}, warn() {}, error() {}, info() {} },
        fetch: fetchImpl,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        requestIdleCallback: undefined
    };
    sandbox.globalThis = sandbox;

    // 最小 document 桩：app.js 顶层只注册监听器，loadBookmarks 只用getElementById/querySelectorAll
    const stubElement = () => ({
        innerHTML: '',
        style: {},
        dataset: {},
        classList: { contains: () => false, add() {}, remove() {} },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        appendChild() {}
    });

    // getElementById 按 id 记忆化，保证多次获取拿到同一对象（loadBookmarks 内外各取一次）
    const elementCache = new Map();
    sandbox.document = {
        readyState: 'loading',
        addEventListener() {},
        removeEventListener() {},
        getElementById: (id) => {
            if (!elementCache.has(id)) {
                elementCache.set(id, id === 'bookmarks-container' ? stubElement() : null);
            }
            return elementCache.get(id);
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        // app.js 的 escapeHtml 依赖 textContent → innerHTML 的浏览器转义行为
        createElement: (tag) => {
            const el = stubElement();
            if (tag === 'div') {
                let text = '';
                Object.defineProperty(el, 'textContent', {
                    set(v) { text = String(v ?? ''); },
                    get() { return text; }
                });
                Object.defineProperty(el, 'innerHTML', {
                    get() {
                        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    }
                });
            }
            return el;
        },
        body: stubElement()
    };

    vm.createContext(sandbox);
    return { sandbox, fetchLog };
}

function evalFile(sandbox, relativePath) {
    vm.runInContext(read(relativePath), sandbox, { filename: relativePath });
}

test('DataManager.getDashboardConfig：并发去重 + 会话缓存 + 保存后同步更新', async () => {
    const { sandbox, fetchLog } = createSandbox({
        routes: [
            {
                match: (url) => url === '/api/config',
                respond: () => jsonResponse(200, { theme: 'dark', showCpu: true })
            }
        ]
    });

    evalFile(sandbox, 'js/data-manager.js');
    const dm = sandbox.window.dataManager;

    // 并发调用只发一次请求
    const [a, b] = await Promise.all([dm.getDashboardConfig(), dm.getDashboardConfig()]);
    assert.equal(fetchLog.filter((u) => u === 'GET /api/config').length, 1);
    assert.equal(a.theme, 'dark');
    assert.equal(b.theme, 'dark');

    // 后续调用命中缓存，不再请求
    await dm.getDashboardConfig();
    assert.equal(fetchLog.filter((u) => u === 'GET /api/config').length, 1);

    // 保存后缓存同步更新（POST 一次），后续读取不再 GET
    await dm.saveDashboardConfig({ theme: 'light', showCpu: false });
    const saved = await dm.getDashboardConfig();
    assert.equal(saved.theme, 'light');
    assert.equal(fetchLog.filter((u) => u === 'GET /api/config').length, 1);
    assert.equal(fetchLog.filter((u) => u === 'POST /api/config').length, 1);
});

test('DataManager.getBookmarks：并发去重、TTL 缓存、失效与保存失效', async () => {
    let fetchCount = 0;
    const { sandbox, fetchLog } = createSandbox({
        routes: [
            {
                match: (url, method) => url === '/api/bookmarks' && method === 'GET',
                respond: () => {
                    fetchCount += 1;
                    return jsonResponse(200, [{ category: 'Daily', items: [] }]);
                }
            },
            {
                match: (url, method) => url === '/api/bookmarks' && method === 'POST',
                respond: () => jsonResponse(200, { success: true })
            }
        ]
    });

    evalFile(sandbox, 'js/data-manager.js');
    const dm = sandbox.window.dataManager;

    // 并发请求合并为一次，且三个调用拿到同一份缓存数组
    const results = await Promise.all([dm.getBookmarks(), dm.getBookmarks(), dm.getBookmarks()]);
    assert.equal(fetchCount, 1);
    assert.ok(results[0] === results[1] && results[1] === results[2], '并发调用应共享同一份结果');
    assert.equal(results[0].length, 1);

    // TTL 内重复调用不再请求
    await dm.getBookmarks();
    assert.equal(fetchCount, 1);

    // 手动失效后重新拉取
    dm.invalidateBookmarks();
    await dm.getBookmarks();
    assert.equal(fetchCount, 2);

    // 保存后失效，下次重新拉取（POST 本身不计入 GET 计数）
    await dm.saveBookmarks([{ category: 'New', items: [] }]);
    await dm.getBookmarks();
    assert.equal(fetchCount, 3);
    assert.equal(fetchLog.filter((u) => u === 'GET /api/bookmarks').length, 3);
    assert.equal(fetchLog.filter((u) => u === 'POST /api/bookmarks').length, 1);
});

test('认证请求单飞：UserManager 并发去重，DataManager.isLoggedIn 复用 UserManager', async () => {
    const { sandbox, fetchLog } = createSandbox({
        routes: [
            {
                match: (url) => url === '/api/users/check-auth',
                respond: () => jsonResponse(200, { isLoggedIn: true, user: { id: 1, username: 'admin', role: 'admin' } })
            }
        ]
    });

    // 先加载 user-manager，再加载 data-manager（复用路径依赖 window.userManager）
    evalFile(sandbox, 'js/user-manager.js');
    evalFile(sandbox, 'js/data-manager.js');

    const um = sandbox.window.userManager;
    const dm = sandbox.window.dataManager;

    // UserManager 并发 checkAuth 只发一次请求
    const [r1, r2] = await Promise.all([um.checkAuth(), um.checkAuth()]);
    assert.equal(fetchLog.filter((u) => u === 'GET /api/users/check-auth').length, 1);
    assert.equal(r1.isLoggedIn, true);
    assert.equal(r2.isLoggedIn, true);

    // DataManager.isLoggedIn 走 UserManager 缓存，不再发请求
    const isLoggedIn = await dm.isLoggedIn();
    assert.equal(isLoggedIn, true);
    assert.equal(fetchLog.filter((u) => u === 'GET /api/users/check-auth').length, 1);

    // 登出后认证缓存失效
    await um.logout();
    assert.equal(um.authChecked, false);
});

test('loadBookmarks 认证门：未登录不发私有数据请求且清空容器', async () => {
    const { sandbox, fetchLog } = createSandbox({
        routes: [
            {
                match: (url) => url === '/api/users/check-auth',
                respond: () => jsonResponse(401, { isLoggedIn: false })
            }
        ]
    });

    evalFile(sandbox, 'js/data-manager.js');
    evalFile(sandbox, 'js/app.js');

    // 隔离渲染后的外围副作用，专注验证认证门与渲染主流程
    sandbox.refreshBookmarksCache = async () => {};
    sandbox.scheduleDuplicateBookmarkCheck = () => {};
    sandbox.restoreBookmarkStyles = async () => {};
    sandbox.syncBookmarkCardWidthsToContainer = () => {};
    sandbox.clampRenderedBookmarkCardWidths = () => {};
    sandbox.updateBookmarkScrollbars = () => {};
    sandbox.renderRightNav = () => {};
    sandbox.enableBookmarkDragAndDrop = () => {};
    sandbox.bindFaviconErrorHandlers = () => {};
    sandbox.bindBookmarkHoverPreview = () => {};
    sandbox.updateBookmarksMemoryCache = () => {};

    const container = sandbox.document.getElementById('bookmarks-container');
    await sandbox.loadBookmarks();

    assert.equal(container.innerHTML, '');
    assert.equal(fetchLog.filter((u) => u === 'GET /api/bookmarks').length, 0);
    assert.equal(fetchLog.filter((u) => u.startsWith('GET /api/bookmark/top')).length, 0);
});

test('loadBookmarks 登录渲染：拉取书签并渲染分类（书签请求恰好一次）', async () => {
    const { sandbox, fetchLog } = createSandbox({
        routes: [
            {
                match: (url) => url === '/api/users/check-auth',
                respond: () => jsonResponse(200, { isLoggedIn: true, user: { id: 1, username: 'admin', role: 'admin' } })
            },
            {
                match: (url) => url === '/api/bookmarks',
                respond: () => jsonResponse(200, [
                    { category: '开发工具', items: [{ name: 'GitHub', url: 'https://github.com', icon: '🐙' }] }
                ])
            },
            {
                match: (url) => url === '/api/config',
                respond: () => jsonResponse(200, {})
            }
        ]
    });

    evalFile(sandbox, 'js/data-manager.js');
    evalFile(sandbox, 'js/app.js');

    sandbox.refreshBookmarksCache = async () => {};
    sandbox.scheduleDuplicateBookmarkCheck = () => {};
    sandbox.restoreBookmarkStyles = async () => {};
    sandbox.syncBookmarkCardWidthsToContainer = () => {};
    sandbox.clampRenderedBookmarkCardWidths = () => {};
    sandbox.updateBookmarkScrollbars = () => {};
    sandbox.renderRightNav = () => {};
    sandbox.enableBookmarkDragAndDrop = () => {};
    sandbox.bindFaviconErrorHandlers = () => {};
    sandbox.bindBookmarkHoverPreview = () => {};

    const container = sandbox.document.getElementById('bookmarks-container');
    await sandbox.loadBookmarks();

    assert.ok(container.innerHTML.includes('开发工具'), `应渲染分类标题，实际 innerHTML: ${container.innerHTML.slice(0, 200)}`);
    assert.ok(container.innerHTML.includes('GitHub'), '应渲染书签名称');
    assert.equal(fetchLog.filter((u) => u === 'GET /api/bookmarks').length, 1);
    assert.equal(fetchLog.filter((u) => u === 'GET /api/config').length, 1);
});

test('农历算法：已知日期对照（含闰月与边界）', async () => {
    const { sandbox } = createSandbox();
    evalFile(sandbox, 'js/datetime-weather.js');

    const getLunarDate = sandbox.window.getLunarDate;
    assert.equal(typeof getLunarDate, 'function', 'datetime-weather.js 应暴露 window.getLunarDate');

    const cases = [
        [[1900, 1, 31], '正月初一'],
        [[2000, 2, 5], '正月初一'],
        [[2023, 1, 22], '正月初一'],
        [[2023, 3, 22], '闰二月初一'],
        [[2024, 2, 10], '正月初一'],
        [[2025, 1, 29], '正月初一'],
        [[2025, 7, 25], '闰六月初一'],
        [[2026, 2, 17], '正月初一'],
        [[2026, 8, 13], '七月初一'],
        [[2026, 8, 17], '七月初五'],
        [[1997, 6, 5], '五月初一']
    ];

    for (const [[y, m, d], expected] of cases) {
        const result = getLunarDate(y, m, d);
        assert.equal(result.month + result.day, expected, `${y}-${m}-${d} 应为 ${expected}`);
    }
});
