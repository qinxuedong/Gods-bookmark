// Main App Logic dependent on DataManager

// 切换单个菜单显示（用于单独按钮）
window.toggleHubMenu = function (menuId) {
    const menu = document.getElementById(menuId);
    const wrapper = menu ? menu.closest('.hub-button-wrapper') : null;

    if (!menu || !wrapper) return;

    const isActive = menu.classList.contains('active') ||
        menu.style.opacity === '1' ||
        menu.style.visibility === 'visible';

    if (isActive) {
        // 关闭当前菜单
        menu.classList.remove('active');
        menu.style.opacity = '0';
        menu.style.visibility = 'hidden';
        wrapper.classList.remove('active');
    } else {
        // 关闭其他菜单
        closeHubMenus();

        // 打开当前菜单
        menu.classList.add('active');
        menu.style.opacity = '1';
        menu.style.visibility = 'visible';
        wrapper.classList.add('active');
    }
};

// 关闭所有菜单
window.closeHubMenus = function () {
    document.querySelectorAll('.hub-menu').forEach(menu => {
        menu.classList.remove('active');
        menu.style.opacity = '0';
        menu.style.visibility = 'hidden';
    });
    document.querySelectorAll('.hub-button-wrapper').forEach(wrapper => {
        wrapper.classList.remove('active');
    });
};

// 点击外部关闭菜单
document.addEventListener('click', function (e) {
    const adminHub = document.getElementById('admin-hub-container');
    const btnHub = document.querySelector('.btn-hub');
    if (adminHub && btnHub && !adminHub.contains(e.target)) {
        adminHub.classList.remove('active');
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // 静默处理favicon加载错误（避免控制台显示404错误）
    window.addEventListener('error', function (e) {
        if (e.target && e.target.tagName === 'IMG' && e.target.src) {
            const src = e.target.src;
            // 匹配所有favicon相关的URL（包括Google的favicon服务）
            if (src.includes('favicon') ||
                src.includes('gstatic.com') ||
                src.includes('google.com/s2') ||
                src.includes('faviconV2')) {
                // 静默处理favicon加载错误
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return true;
            }
        }
        // 处理全局错误消息（可能来自网络请求）
        if (e.message && (
            e.message.includes('favicon') ||
            e.message.includes('gstatic.com') ||
            e.message.includes('faviconV2') ||
            e.message.includes('Failed to load resource'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return true;
        }
    }, true);

    // 也监听unhandledrejection事件（处理Promise rejections）
    window.addEventListener('unhandledrejection', function (e) {
        if (e.reason && e.reason.message &&
            (e.reason.message.includes('favicon') ||
                e.reason.message.includes('gstatic.com') ||
                e.reason.message.includes('faviconV2'))) {
            e.preventDefault();
        }
    });

    // 重写console.error来过滤favicon相关的错误
    const originalConsoleError = console.error;
    console.error = function (...args) {
        const message = args.join(' ');
        if (message.includes('favicon') ||
            message.includes('gstatic.com') ||
            message.includes('faviconV2') ||
            (message.includes('Failed to load resource') && message.includes('favicon'))) {
            // 静默favicon相关的错误
            return;
        }
        originalConsoleError.apply(console, args);
    };

    // 绑定HTML中的内联事件处理器（符合CSP）
    bindInlineEventHandlers();

    // Check if on login page, if so skip
    if (window.location.pathname.includes('login.html')) return;

    await initGlobalUI();

    const path = window.location.pathname;
    // Handle both root path and index.html
    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
        initDashboard();
    }
});

// 绑定HTML中的内联事件处理器（符合CSP）
function bindInlineEventHandlers() {
    // 控制中心按钮
    const controlCenterBtn = document.getElementById('control-center-btn');
    if (controlCenterBtn) {
        controlCenterBtn.addEventListener('click', (e) => {
            if (typeof toggleControlCenter === 'function') {
                toggleControlCenter(e);
            }
        });
    }

    // 导入文件输入框
    const importFile = document.getElementById('import-file');
    if (importFile) {
        importFile.addEventListener('change', function () {
            if (typeof handleBookmarkImport === 'function') {
                handleBookmarkImport(this);
            }
        });
    }

    // 待办事项相关按钮
    const btnAddTodo = document.getElementById('btn-add-todo');
    if (btnAddTodo) {
        btnAddTodo.addEventListener('click', () => {
            if (typeof showAddTodoInput === 'function') {
                showAddTodoInput();
            }
        });
    }

    const newTodoInput = document.getElementById('new-todo-input');
    if (newTodoInput) {
        newTodoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                // 回车键确认添加（Shift+Enter 换行）
                e.preventDefault();
                if (typeof addTodo === 'function') {
                    addTodo();
                }
            } else if (e.key === 'Escape') {
                // ESC 键取消
                e.preventDefault();
                if (typeof hideAddTodoInput === 'function') {
                    hideAddTodoInput();
                }
            }
        });
    }

    const btnAddTodoConfirm = document.getElementById('btn-add-todo-confirm');
    if (btnAddTodoConfirm) {
        btnAddTodoConfirm.addEventListener('click', () => {
            if (typeof addTodo === 'function') {
                addTodo();
            }
        });
    }

    const btnAddTodoCancel = document.getElementById('btn-add-todo-cancel');
    if (btnAddTodoCancel) {
        btnAddTodoCancel.addEventListener('click', () => {
            if (typeof hideAddTodoInput === 'function') {
                hideAddTodoInput();
            }
        });
    }

    // 绑定添加待办图片删除按钮
    const addTodoImageRemove = document.getElementById('add-todo-image-remove');
    if (addTodoImageRemove) {
        addTodoImageRemove.addEventListener('click', () => {
            setAddTodoImageState('');
        });
    }

    // 添加待办模态框关闭按钮
    const addTodoModalClose = document.getElementById('add-todo-modal-close');
    if (addTodoModalClose) {
        addTodoModalClose.addEventListener('click', () => {
            if (typeof hideAddTodoInput === 'function') {
                hideAddTodoInput();
            }
        });
    }

    const todosToggleButton = document.getElementById('todos-toggle-button');
    if (todosToggleButton) {
        todosToggleButton.addEventListener('click', () => {
            if (typeof toggleTodosExpanded === 'function') {
                toggleTodosExpanded();
            }
        });
    }

    // 书签模态框按钮
    const bookmarkModalCancel = document.getElementById('bookmark-modal-cancel');
    if (bookmarkModalCancel) {
        bookmarkModalCancel.addEventListener('click', () => {
            if (typeof closeBookmarkModal === 'function') {
                closeBookmarkModal();
            }
        });
    }

    const bookmarkModalSave = document.getElementById('bookmark-modal-save');
    if (bookmarkModalSave) {
        bookmarkModalSave.addEventListener('click', () => {
            if (typeof saveBookmarkFromModal === 'function') {
                saveBookmarkFromModal();
            }
        });
    }

    // 为书签名称和网址输入框添加回车键确认
    const bookmarkNameInput = document.getElementById('bookmark-name');
    const bookmarkUrlInput = document.getElementById('bookmark-url');

    if (bookmarkNameInput) {
        bookmarkNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // 如果网址输入框为空，聚焦到网址输入框；否则保存
                if (bookmarkUrlInput && !bookmarkUrlInput.value.trim()) {
                    bookmarkUrlInput.focus();
                } else if (typeof saveBookmarkFromModal === 'function') {
                    saveBookmarkFromModal();
                }
            }
        });
    }

    if (bookmarkUrlInput) {
        bookmarkUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof saveBookmarkFromModal === 'function') {
                    saveBookmarkFromModal();
                }
            }
        });
    }

    // 分类模态框按钮
    const categoryModalCancel = document.getElementById('category-modal-cancel');
    if (categoryModalCancel) {
        categoryModalCancel.addEventListener('click', () => {
            if (typeof closeCategoryModal === 'function') {
                closeCategoryModal();
            }
        });
    }

    const categoryModalSave = document.getElementById('category-modal-save');
    if (categoryModalSave) {
        categoryModalSave.addEventListener('click', () => {
            if (typeof saveCategoryFromModal === 'function') {
                saveCategoryFromModal();
            }
        });
    }

    // 为分类名称输入框添加回车键确认
    const categoryNameInput = document.getElementById('category-name');
    if (categoryNameInput) {
        categoryNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof saveCategoryFromModal === 'function') {
                    saveCategoryFromModal();
                }
            }
        });
    }

    // 地点模态框按钮
    const locationModalCancel = document.getElementById('location-modal-cancel');
    if (locationModalCancel) {
        locationModalCancel.addEventListener('click', () => {
            if (typeof closeLocationModal === 'function') {
                closeLocationModal();
            }
        });
    }
}

function getAddTodoModalElements() {
    return {
        modal: document.getElementById('add-todo-modal'),
        input: document.getElementById('new-todo-input'),
        imagePreview: document.getElementById('add-todo-image-preview'),
        imageDisplay: document.getElementById('add-todo-image-display'),
    };
}

function setAddTodoImageState(imageData) {
    const {
        modal,
        imagePreview,
        imageDisplay,
    } = getAddTodoModalElements();

    if (!modal) {
        return;
    }

    const hasImage = !!(imageData && imageData.trim() !== '');
    modal.dataset.todoImage = hasImage ? imageData : '';

    if (imageDisplay) {
        imageDisplay.src = hasImage ? imageData : '';
    }
    if (imagePreview) {
        imagePreview.style.display = hasImage ? 'block' : 'none';
    }
}

function bindAddTodoModalEvents() {
    const { modal, input } = getAddTodoModalElements();
    if (!modal || !input || modal.dataset.eventsBound === 'true') {
        return;
    }

    input.addEventListener('paste', handleAddTodoImagePaste);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideAddTodoInput();
        }
    });

    modal.dataset.eventsBound = 'true';
}

function bindReplacingEventHandler(element, eventName, handler) {
    if (!element || !element.parentNode) {
        return null;
    }

    const nextElement = element.cloneNode(true);
    element.parentNode.replaceChild(nextElement, element);
    nextElement.addEventListener(eventName, handler);
    return nextElement;
}

async function initGlobalUI() {
    // 绑定设置侧边栏关闭按钮事件
    const closeBtn = document.getElementById('admin-sidebar-close-btn');
    if (closeBtn) {
        // 移除旧的事件监听器（如果存在）
        bindReplacingEventHandler(closeBtn, 'click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // 直接操作DOM关闭设置面板
            const sidebar = document.getElementById('admin-sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
                document.body.classList.remove('sidebar-open');
            }
            // 如果函数存在，也调用它
            if (typeof window.closeSettingsSidebar === 'function') {
                window.closeSettingsSidebar();
            }
        });
    }

    // 并行发起配置与认证检查，避免串行等待（外网高延迟场景下尤为明显）
    const authStatusPromise = dataManager.isLoggedIn().catch(() => false);
    const userAuthPromise = window.userManager
        ? window.userManager.checkAuth().catch((error) => {
            console.error('[initGlobalUI] Error checking user auth:', error);
            return null;
        })
        : Promise.resolve(null);

    try {
        // 加载并显示网站标题
        try {
            const config = await dataManager.getDashboardConfig();
            const siteTitle = config.siteTitle || 'God\'s Bookmark';
            const logoElement = document.querySelector('.logo');
            if (logoElement) {
                logoElement.textContent = siteTitle;
            }
            document.title = siteTitle;
        } catch (error) {
            console.error('Failed to load dashboard config:', error);
            // 使用默认标题
            const logoElement = document.querySelector('.logo');
            if (logoElement) {
                logoElement.textContent = 'God\'s Bookmark';
            }
            document.title = 'God\'s Bookmark';
        }

        // Inject Admin Controls to Header
        const navUl = document.querySelector('nav ul');
        if (!navUl) {
            console.error('[initGlobalUI] Navigation ul not found!');
            return;
        }

        // 获取HTML中的登录链接（如果存在）
        const loginLinkItem = document.getElementById('login-link-item');

        // 立即隐藏登录按钮，避免页面加载时闪现
        // 登录功能已集成到控制中心菜单中
        if (loginLinkItem) {
            loginLinkItem.style.display = 'none';
        }

        // 清除之前动态添加的退出登录链接（保留HTML中的登录链接）
        const allNavLinks = navUl.querySelectorAll('li a');
        allNavLinks.forEach(link => {
            const onclick = link.getAttribute('onclick');
            // 只移除动态添加的退出登录链接，不删除HTML中的登录链接
            if (onclick && onclick.includes('logout')) {
                link.closest('li')?.remove();
            }
        });

        // 检查登录状态（promise 已在上方并行发起，此处等待结果）
        let isLoggedIn = false;
        try {
            isLoggedIn = await authStatusPromise;
            console.log('[initGlobalUI] Login status:', isLoggedIn);

            const authResult = await userAuthPromise;
            if (authResult && authResult.isLoggedIn && authResult.user) {
                console.log('[initGlobalUI] Current user:', authResult.user);
            }
        } catch (error) {
            console.error('[initGlobalUI] Failed to check login status:', error);
            // API 调用失败时，默认显示登录链接
            isLoggedIn = false;
        }

        // 控制中心始终可见（无论登录状态）
        showControlCenter();

        // 登录按钮已在上面立即隐藏，这里不需要再次隐藏
        // 登录功能已集成到控制中心菜单中

        // 根据登录状态更新控制中心菜单内容
        updateControlCenterMenu(isLoggedIn);

        // 隐藏Admin Hub Top（已合并到控制中心）
        const adminHubTop = document.getElementById('admin-hub-top');
        if (adminHubTop) {
            adminHubTop.style.display = 'none';
        }

        // 未登录时隐藏所有板块，只保留时间板块
        if (!isLoggedIn) {
            // 隐藏便签待办区域
            const todosSection = document.getElementById('todos-section');
            if (todosSection) {
                todosSection.style.display = 'none';
            }

            // 隐藏常用标签栏（上帝的指引）
            const frequentBookmarksBar = document.getElementById('frequent-bookmarks-bar');
            if (frequentBookmarksBar) {
                frequentBookmarksBar.style.display = 'none';
            }

            // 隐藏书签容器
            const bookmarksContainer = document.getElementById('bookmarks-container');
            if (bookmarksContainer) {
                bookmarksContainer.closest('section')?.style.setProperty('display', 'none', 'important');
            }

            // 隐藏搜索浮窗
            const searchModal = document.getElementById('global-search-modal');
            if (searchModal) {
                searchModal.style.display = 'none';
            }

            // 隐藏管理员侧边栏
            const adminSidebar = document.getElementById('admin-sidebar');
            if (adminSidebar) {
                adminSidebar.style.display = 'none';
            }

            // 确保时间板块可见
            const datetimeSection = document.getElementById('datetime-section');
            if (datetimeSection) {
                datetimeSection.style.display = 'flex';
                datetimeSection.style.visibility = 'visible';
            }

            // 在屏幕中心显示提示文字
            showLoginMessage();
        } else {
            // 登录时显示所有板块
            const frequentBookmarksBar = document.getElementById('frequent-bookmarks-bar');
            if (frequentBookmarksBar) {
                frequentBookmarksBar.style.display = '';
            }

            const bookmarksContainer = document.getElementById('bookmarks-container');
            if (bookmarksContainer) {
                bookmarksContainer.closest('section')?.style.removeProperty('display');
            }

            const adminSidebar = document.getElementById('admin-sidebar');
            if (adminSidebar) {
                adminSidebar.style.display = '';
            }

            // 隐藏登录提示信息
            hideLoginMessage();
        }
    } catch (error) {
        console.error('[initGlobalUI] Error in initGlobalUI:', error);
        // 确保至少显示登录链接
        const navUl = document.querySelector('nav ul');
        if (navUl) {
            // 确保控制中心可见
            showControlCenter();
            updateControlCenterMenu(false);
        } else {
            console.error('[initGlobalUI] Navigation ul not found in error handler');
        }

        // 错误时也隐藏所有板块，只保留时间板块
        const todosSection = document.getElementById('todos-section');
        if (todosSection) {
            todosSection.style.display = 'none';
        }

        const frequentBookmarksBar = document.getElementById('frequent-bookmarks-bar');
        if (frequentBookmarksBar) {
            frequentBookmarksBar.style.display = 'none';
        }

        const bookmarksContainer = document.getElementById('bookmarks-container');
        if (bookmarksContainer) {
            bookmarksContainer.closest('section')?.style.setProperty('display', 'none', 'important');
        }

        const searchModal = document.getElementById('global-search-modal');
        if (searchModal) {
            searchModal.style.display = 'none';
        }

        const adminSidebar = document.getElementById('admin-sidebar');
        if (adminSidebar) {
            adminSidebar.style.display = 'none';
        }

        // 确保时间板块可见
        const datetimeSection = document.getElementById('datetime-section');
        if (datetimeSection) {
            datetimeSection.style.display = 'flex';
            datetimeSection.style.visibility = 'visible';
        }

        // 在屏幕中心显示提示文字
        showLoginMessage();
    }

    console.log('[initGlobalUI] Initialization completed');

    // 页面完全加载后再次确保控制中心正确显示并更新菜单
    if (document.readyState === 'complete') {
        showControlCenter();
        dataManager.isLoggedIn().then(isLoggedIn => {
            updateControlCenterMenu(isLoggedIn);
        }).catch(() => {
            updateControlCenterMenu(false);
        });
    } else {
        window.addEventListener('load', () => {
            showControlCenter();
            dataManager.isLoggedIn().then(isLoggedIn => {
                updateControlCenterMenu(isLoggedIn);
            }).catch(() => {
                updateControlCenterMenu(false);
            });
        });
    }
}

// 显示登录提示信息
function showLoginMessage() {
    // 检查是否已存在提示信息
    let loginMessage = document.getElementById('login-message');
    if (!loginMessage) {
        // 创建提示信息元素
        loginMessage = document.createElement('div');
        loginMessage.id = 'login-message';
        loginMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 2rem;
            font-weight: 500;
            color: var(--accent-color);
            text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
            z-index: 1000;
            text-align: center;
            pointer-events: none;
            animation: fadeInUp 0.8s ease-out;
            line-height: 1.8;
            max-width: 90%;
        `;
        // 显示文字内容
        loginMessage.textContent = '天行健 君子以自强不息';
        document.body.appendChild(loginMessage);
    } else {
        loginMessage.style.display = 'block';
    }
}

// 隐藏登录提示信息
function hideLoginMessage() {
    const loginMessage = document.getElementById('login-message');
    if (loginMessage) {
        loginMessage.style.display = 'none';
    }
}

// 显示控制中心的统一函数（始终显示）
function showControlCenter() {
    const controlCenterItem = document.getElementById('control-center-item');
    const controlCenterBtn = document.getElementById('control-center-btn');

    if (!controlCenterItem) {
        console.error('[showControlCenter] ❌ control-center-item NOT FOUND in DOM!');
        return;
    }

    // 始终显示控制中心
    controlCenterItem.style.display = 'list-item';
    controlCenterItem.style.visibility = 'visible';
    controlCenterItem.style.opacity = '1';

    // 确保按钮也可见
    if (controlCenterBtn) {
        controlCenterBtn.style.display = 'flex';
        controlCenterBtn.style.visibility = 'visible';
        controlCenterBtn.style.opacity = '1';
    }

    console.log('[showControlCenter] ✅ Control center displayed');
}

// 根据登录状态更新控制中心菜单内容
async function updateControlCenterMenu(isLoggedIn) {
    const menu = document.getElementById('control-center-menu');
    if (!menu) {
        console.error('[updateControlCenterMenu] ❌ control-center-menu NOT FOUND!');
        return;
    }

    console.log('[updateControlCenterMenu] Updating menu for logged in:', isLoggedIn);

    if (isLoggedIn) {
        // 登录后的菜单内容
        menu.innerHTML = `
            <a href="#" class="control-menu-link" data-action="settings">
                <span class="menu-icon">⚙️</span>
                <span>全局设置</span>
            </a>
            <a href="#" class="control-menu-link" data-action="add-category">
                <span class="menu-icon">➕</span>
                <span>添加分组</span>
            </a>
            <a href="#" class="control-menu-link" data-action="import">
                <span class="menu-icon">📂</span>
                <span>导入书签</span>
            </a>
            <a href="#" class="control-menu-link" data-action="export">
                <span class="menu-icon">💾</span>
                <span>导出书签</span>
            </a>
            <a href="#" class="control-menu-link" data-action="merge-bookmarks">
                <span class="menu-icon">📚</span>
                <span>合并书签</span>
            </a>
            <div class="menu-divider"></div>
            <a href="#" class="control-menu-link" data-action="logout">
                <span class="menu-icon">🚪</span>
                <span>退出登录</span>
            </a>
        `;
    } else {
        // 未登录时的菜单内容
        menu.innerHTML = `
            <a href="login.html" class="control-menu-link" data-action="login">
                <span class="menu-icon">🔑</span>
                <span>登录</span>
            </a>
        `;
    }

    // 绑定菜单项点击事件
    bindControlCenterMenuEvents();
}

// 绑定控制中心菜单项的事件（使用事件委托，避免重复绑定）
let controlCenterMenuHandler = null;
let controlCenterOutsideClickHandler = null;
const CONTROL_CENTER_DELAY_MS = 100;

function runAfterControlCenterClose(callback) {
    setTimeout(callback, CONTROL_CENTER_DELAY_MS);
}

function executeAfterClosingControlCenter(callback) {
    closeControlCenter();
    runAfterControlCenterClose(callback);
}

function clearControlCenterOutsideClickHandler() {
    if (controlCenterOutsideClickHandler) {
        document.removeEventListener('click', controlCenterOutsideClickHandler);
        controlCenterOutsideClickHandler = null;
    }
}

async function openSettingsSidebarFromControlCenter() {
    if (typeof window.openSettingsSidebar === 'function') {
        try {
            await window.openSettingsSidebar();
            return;
        } catch (error) {
            console.error('[bindControlCenterMenuEvents] window.openSettingsSidebar failed, falling back:', error);
        }
    }

    const sidebar = document.getElementById('admin-sidebar');
    if (!sidebar) {
        console.error('[bindControlCenterMenuEvents] admin-sidebar element not found!');
        return;
    }

    sidebar.classList.add('open');
    document.body.classList.add('sidebar-open');

    let retries = 0;
    const maxRetries = 5;
    const tryRenderCardControls = async () => {
        if (typeof window.renderCardControls === 'function') {
            try {
                await window.renderCardControls();
                console.log('[bindControlCenterMenuEvents] renderCardControls called successfully');
            } catch (error) {
                console.error('[bindControlCenterMenuEvents] renderCardControls error:', error);
            }
            return;
        }

        retries++;
        if (retries < maxRetries) {
            console.log(`[bindControlCenterMenuEvents] renderCardControls not found, retrying... (${retries}/${maxRetries})`);
            setTimeout(tryRenderCardControls, 200);
            return;
        }

        console.error('[bindControlCenterMenuEvents] renderCardControls is not a function after', maxRetries, 'retries!');
        console.error('[bindControlCenterMenuEvents] Available window functions:', Object.keys(window).filter(k => k.includes('render') || k.includes('Card') || k.includes('Settings')));
    };

    await tryRenderCardControls();
}

async function logoutFromControlCenter() {
    try {
        if (typeof dataManager !== 'undefined' && typeof dataManager.logout === 'function') {
            console.log('[bindControlCenterMenuEvents] Calling dataManager.logout()...');
            await dataManager.logout();
            return;
        }

        console.error('[bindControlCenterMenuEvents] dataManager.logout not found!', typeof dataManager, dataManager);
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' });
        window.location.reload();
    } catch (error) {
        console.error('[bindControlCenterMenuEvents] Logout error:', error);
        window.location.reload();
    }
}

function openAddCategoryFromControlCenter() {
    if (typeof window.openAddCategoryModal === 'function') {
        window.openAddCategoryModal();
        return;
    }

    console.error('[bindControlCenterMenuEvents] openAddCategoryModal is not a function!', typeof window.openAddCategoryModal);
}

function triggerImportFromControlCenter() {
    const importFile = document.getElementById('import-file');
    if (importFile) {
        importFile.click();
    }
}

async function exportFromControlCenter() {
    if (typeof window.exportBookmarks === 'function') {
        await window.exportBookmarks();
    }
}

async function mergeBookmarksFromControlCenter() {
    if (typeof window.mergeBookmarksManually === 'function') {
        await window.mergeBookmarksManually();
    }
}

function openLoginFromControlCenter() {
    window.location.href = 'login.html';
}

function bindControlCenterMenuEvents() {
    const menu = document.getElementById('control-center-menu');
    if (!menu) return;

    // 移除旧的事件监听器（如果存在）
    if (controlCenterMenuHandler) {
        menu.removeEventListener('click', controlCenterMenuHandler);
    }

    // 创建新的事件处理器
    controlCenterMenuHandler = async (e) => {
        // 阻止事件冒泡，避免触发覆盖层的点击事件
        e.stopPropagation();

        const link = e.target.closest('.control-menu-link');
        if (!link) return;

        e.preventDefault();

        const action = link.getAttribute('data-action');
        console.log('[bindControlCenterMenuEvents] Menu item clicked:', action);

        switch (action) {
            case 'settings':
                console.log('[bindControlCenterMenuEvents] Opening settings sidebar...');
                executeAfterClosingControlCenter(async () => {
                    await openSettingsSidebarFromControlCenter();
                });
                break;
            case 'add-category':
                console.log('[bindControlCenterMenuEvents] Opening add category modal...');
                executeAfterClosingControlCenter(() => {
                    openAddCategoryFromControlCenter();
                });
                break;
            case 'import':
                executeAfterClosingControlCenter(() => {
                    triggerImportFromControlCenter();
                });
                break;
            case 'export':
                executeAfterClosingControlCenter(async () => {
                    await exportFromControlCenter();
                });
                break;
            case 'merge-bookmarks':
                executeAfterClosingControlCenter(async () => {
                    await mergeBookmarksFromControlCenter();
                });
                break;
            case 'logout':
                console.log('[bindControlCenterMenuEvents] Logging out...');
                closeControlCenter();
                await logoutFromControlCenter();
                break;
            case 'login':
                // 直接跳转到登录页面
                openLoginFromControlCenter();
                break;
            default:
                console.warn('[bindControlCenterMenuEvents] Unknown action:', action);
        }
    };

    // 绑定新的事件监听器
    menu.addEventListener('click', controlCenterMenuHandler);
    console.log('[bindControlCenterMenuEvents] ✅ Event handler bound');
}

// 控制中心下拉菜单
window.toggleControlCenter = async function (event) {
    if (event) {
        event.stopPropagation();
    }
    const menu = document.getElementById('control-center-menu');
    if (!menu) return;

    // 检查菜单是否打开（通过 class 判断）
    const isOpen = menu.classList.contains('open');

    if (isOpen) {
        closeControlCenter();
    } else {
        // 在打开菜单前，先检查登录状态并更新菜单内容
        const isLoggedIn = await dataManager.isLoggedIn().catch(() => false);
        await updateControlCenterMenu(isLoggedIn);
        // 确保事件已绑定
        // 打开菜单
        openControlCenter();
    }
};

window.openControlCenter = function () {
    const menu = document.getElementById('control-center-menu');
    const btn = document.getElementById('control-center-btn');

    if (menu && btn) {
        // 获取按钮位置用于设置菜单的top
        const btnRect = btn.getBoundingClientRect();
        menu.style.top = btnRect.top + 'px';

        // 定位菜单：优先使用按钮右侧定位，如果按钮太靠右则使用左侧定位
        const viewportWidth = window.innerWidth;
        const menuWidth = 180; // 菜单最大宽度
        const padding = 20; // 距离边缘的最小距离

        // 如果按钮右侧有足够空间，使用右侧定位
        if (btnRect.right + menuWidth + padding <= viewportWidth) {
            menu.style.left = (btnRect.right + 8) + 'px';
            menu.style.right = 'auto';
        } else {
            // 如果按钮右侧空间不足，使用左侧定位（对齐按钮左侧）
            menu.style.left = 'auto';
            menu.style.right = (viewportWidth - btnRect.left + 8) + 'px';
        }
        menu.style.height = 'auto'; // 改为自动高度
        menu.style.maxHeight = 'calc(100vh - ' + btnRect.top + 'px)'; // 限制最大高度

        // 显示菜单（使用 class 触发动画）
        menu.style.display = 'flex';

        // 使用 requestAnimationFrame 确保 display 已经应用后再添加 class
        requestAnimationFrame(() => {
            menu.classList.add('open');
            // 设置点击空白处关闭功能
            setupControlCenterOutsideClick();
        });
    }
};

window.closeControlCenter = function () {
    const menu = document.getElementById('control-center-menu');

    // 移除点击空白处关闭的事件监听器
    clearControlCenterOutsideClickHandler();

    if (menu) {
        // 移除 open class 触发动画
        menu.classList.remove('open');

        // 动画结束后隐藏
        setTimeout(() => {
            menu.style.display = 'none';
        }, 200); // 与 CSS transition 时间一致
    }
};

// 点击空白处关闭控制中心菜单
function setupControlCenterOutsideClick() {
    clearControlCenterOutsideClickHandler();
    // Delay listener registration so the opening click does not immediately close the menu.
    runAfterControlCenterClose(() => {
        controlCenterOutsideClickHandler = function (event) {
            const menu = document.getElementById('control-center-menu');
            const btn = document.getElementById('control-center-btn');

            if (!menu || !menu.classList.contains('open')) {
                // 菜单未打开，移除监听器
                clearControlCenterOutsideClickHandler();
                return;
            }

            // 检查点击的目标是否在菜单内或按钮上
            const isClickInsideMenu = menu && menu.contains(event.target);
            const isClickOnButton = btn && btn.contains(event.target);

            // 如果点击的是外部（既不是菜单也不是按钮），则关闭菜单
            if (!isClickInsideMenu && !isClickOnButton) {
                closeControlCenter();
            }
        };

        // 添加事件监听器
        document.addEventListener('click', controlCenterOutsideClickHandler);
    });
}

let bookmarksRealtimeSource = null;
let bookmarksRealtimeRefreshTimer = null;
let latestBookmarksMemoryCache = [];
let suppressNextRealtimeBrowserFullSyncUntil = 0;

function cloneBookmarksDataForCache(bookmarks) {
    return (Array.isArray(bookmarks) ? bookmarks : []).map(category => ({
        ...category,
        items: (Array.isArray(category?.items) ? category.items : []).map(item => ({ ...item }))
    }));
}

function updateBookmarksMemoryCache(bookmarks) {
    latestBookmarksMemoryCache = cloneBookmarksDataForCache(bookmarks);
    return cloneBookmarksDataForCache(latestBookmarksMemoryCache);
}

function getBookmarksMemoryCache() {
    return cloneBookmarksDataForCache(latestBookmarksMemoryCache);
}

async function getBookmarksForInteractiveAction() {
    if (Array.isArray(latestBookmarksMemoryCache) && latestBookmarksMemoryCache.length > 0) {
        return getBookmarksMemoryCache();
    }

    const bookmarks = await dataManager.getBookmarks();
    return updateBookmarksMemoryCache(bookmarks);
}

function markLocalRealtimeBrowserSyncWindow(durationMs = 2000) {
    suppressNextRealtimeBrowserFullSyncUntil = Date.now() + durationMs;
}

function shouldSkipRealtimeBrowserFullSync() {
    return Date.now() < suppressNextRealtimeBrowserFullSyncUntil;
}

async function refreshBookmarksFromRealtime(changeType) {
    if (changeType === 'bookmarks-replaced' && shouldSkipRealtimeBrowserFullSync()) {
        console.log('[RealtimeSync] Skip local refresh for self-originated full bookmark update');
        return;
    }

    if (bookmarksRealtimeRefreshTimer) {
        clearTimeout(bookmarksRealtimeRefreshTimer);
    }

    bookmarksRealtimeRefreshTimer = window.setTimeout(async () => {
        bookmarksRealtimeRefreshTimer = null;

        // 远端变更已到达，本地书签缓存立即失效，避免短缓存返回旧数据
        if (window.dataManager && typeof window.dataManager.invalidateBookmarks === 'function') {
            window.dataManager.invalidateBookmarks();
        }

        try {
            console.log('[RealtimeSync] Refreshing bookmarks after change:', changeType);
            await loadBookmarks();

            if (typeof refreshBookmarksCache === 'function') {
                await refreshBookmarksCache();
            }
        } catch (error) {
            console.error('[RealtimeSync] Failed to refresh bookmarks after realtime change:', error);
        }
    }, 120);
}

async function syncRealtimeChangeToBrowser(change) {
    if (!change || !change.type) {
        return;
    }

    try {
        switch (change.type) {
            case 'bookmark-created':
                if (change.bookmark && change.bookmark.url) {
                    await syncBookmarkAddToBrowser(
                        change.bookmark.url,
                        change.bookmark.name,
                        change.category,
                        change.index
                    );
                }
                break;
            case 'bookmark-removed':
                if (change.bookmark && change.bookmark.url) {
                    await syncDeleteToBrowser(change.bookmark.url);
                }
                break;
            case 'bookmark-moved':
                if (change.bookmark && change.bookmark.url) {
                    await syncBookmarkMoveToBrowser(
                        change.bookmark.url,
                        change.category,
                        change.index
                    );
                }
                break;
            case 'folder-created':
                if (change.folderName) {
                    await syncAddFolderToBrowser(change.folderName);
                }
                break;
            case 'folder-removed':
                if (change.folderName) {
                    await syncDeleteFolderToBrowser(change.folderName);
                }
                break;
            case 'bookmarks-replaced':
                if (!shouldSkipRealtimeBrowserFullSync()) {
                    await syncBrowserBookmarksFromServer();
                }
                break;
            default:
                break;
        }
    } catch (error) {
        console.error('[RealtimeSync] Failed to sync realtime change to browser:', error);
    }
}

function setupBookmarksRealtimeSync() {
    if (bookmarksRealtimeSource || typeof window.EventSource === 'undefined') {
        return;
    }

    const eventSource = new EventSource('/api/bookmarks/stream');
    bookmarksRealtimeSource = eventSource;

    eventSource.addEventListener('connected', (event) => {
        try {
            const payload = JSON.parse(event.data);
            console.log('[RealtimeSync] Connected to bookmark stream:', payload);
        } catch (error) {
            console.warn('[RealtimeSync] Failed to parse connected event:', error);
        }
    });

    eventSource.addEventListener('bookmark-change', async (event) => {
        try {
            const change = JSON.parse(event.data);
            console.log('[RealtimeSync] Received bookmark change:', change);
            await syncRealtimeChangeToBrowser(change);
            await refreshBookmarksFromRealtime(change.type);
        } catch (error) {
            console.error('[RealtimeSync] Failed to handle bookmark change:', error);
        }
    });

    eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
            bookmarksRealtimeSource = null;
        }
    };
}

/* --- Dashboard Logic --- */
async function initDashboard() {
    // 恢复主题设置（优先执行；配置已在 initGlobalUI 预取，此处命中缓存不再发请求）
    if (typeof window.restoreTheme === 'function') {
        await window.restoreTheme();
    }

    // 并行加载互不依赖的模块：书签渲染、监控部件、常用标签栏
    const bookmarksReady = loadBookmarks();
    const monitorReady = initMonitor();
    const frequentReady = loadFrequentBookmarks();

    await bookmarksReady;

    // 初始化全局搜索（依赖书签数据，此时复用书签缓存，不再重复全量拉取）
    await initGlobalSearch();

    // 检查用户认证状态（多用户模式，认证结果已缓存，无额外请求）
    if (window.userManager) {
        try {
            const authResult = await window.userManager.checkAuth();
            console.log('[initDashboard] User auth check result:', authResult);
            if (authResult && authResult.isLoggedIn && authResult.user) {
                console.log('[initDashboard] Current user:', authResult.user);
            }
        } catch (error) {
            console.error('[initDashboard] Error checking user auth:', error);
        }
    }

    // 加载便签待办
    const isLoggedIn = await dataManager.isLoggedIn();
    if (isLoggedIn) {
        setupBookmarksRealtimeSync();
        await initTodos();
    }

    // 等待并行模块完成
    await Promise.all([monitorReady, frequentReady]);

    // 初始化滚动检测，为时间日期区域添加毛玻璃背景
    initDatetimeScrollEffect();
}

// 检测滚动内容是否经过时间日期区域，添加毛玻璃背景
function initDatetimeScrollEffect() {
    const datetimeSection = document.getElementById('datetime-section');
    const mainContainer = document.querySelector('main.container');

    if (!datetimeSection) return;

    function checkScrollOverlap() {
        const datetimeRect = datetimeSection.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;

        // 时间区域是固定的（position: fixed, top: 0），高度约260px
        // 主容器有 padding-top: 375px，所以主内容从375px位置开始
        // 当滚动时，如果滚动位置使得主内容的可见部分进入时间区域范围，就应该添加毛玻璃

        // 检测所有可能的内容元素（书签卡片、上帝的指引区域等）
        let hasContentBehind = false;

        // 检测主容器是否与时间区域重叠
        if (mainContainer) {
            const mainRect = mainContainer.getBoundingClientRect();
            // 如果主容器的任何部分与时间区域重叠，并且已经滚动
            if (mainRect.top < datetimeRect.bottom &&
                mainRect.bottom > datetimeRect.top &&
                scrollY > 0) {
                hasContentBehind = true;
            }
        }

        // 检测所有书签卡片是否与时间区域重叠
        const bookmarkCards = document.querySelectorAll('#bookmarks-container .bookmark-card');
        if (!hasContentBehind && bookmarkCards.length > 0) {
            bookmarkCards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                // 如果任何书签卡片与时间区域重叠
                if (cardRect.top < datetimeRect.bottom &&
                    cardRect.bottom > datetimeRect.top) {
                    hasContentBehind = true;
                }
            });
        }

        // 检测上帝的指引区域是否与时间区域重叠
        const frequentBar = document.getElementById('frequent-bookmarks-bar');
        if (!hasContentBehind && frequentBar) {
            const frequentRect = frequentBar.getBoundingClientRect();
            if (frequentRect.top < datetimeRect.bottom &&
                frequentRect.bottom > datetimeRect.top) {
                hasContentBehind = true;
            }
        }

        // 如果页面滚动且有任何内容在时间区域范围内，添加毛玻璃效果
        if (hasContentBehind && scrollY > 50) {
            datetimeSection.classList.add('has-content-behind');
        } else {
            datetimeSection.classList.remove('has-content-behind');
        }
    }

    // 监听滚动事件（使用节流优化性能）
    let ticking = false;
    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                checkScrollOverlap();
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // 初始检查
    checkScrollOverlap();
    // 使用 ResizeObserver 监听容器大小变化
    if (window.ResizeObserver && mainContainer) {
        const resizeObserver = new ResizeObserver(() => {
            checkScrollOverlap();
        });
        resizeObserver.observe(mainContainer);
    }

    // 监听DOM变化，确保新添加的内容也能被检测到
    if (window.MutationObserver && mainContainer) {
        const mutationObserver = new MutationObserver(() => {
            checkScrollOverlap();
        });
        mutationObserver.observe(mainContainer, {
            childList: true,
            subtree: true
        });
    }
}

/* --- Todos Logic --- */
let todosList = [];

// 待办事项展开/收起状态
let todosExpanded = false;

// 便签待办面板折叠状态（完全折叠）- 已废弃
let todosCollapsed = false;

// 便签待办面板钉住状态（双击后钉住，不再悬浮停靠）
let todosPinned = false;

// 初始化便签待办
async function initTodos() {
    const todosSection = document.getElementById('todos-section');
    if (!todosSection) {
        console.warn('[Todos] todos-section element not found');
        return;
    }

    try {
        const isLoggedIn = await dataManager.isLoggedIn();
        console.log('[Todos] Init - isLoggedIn:', isLoggedIn);

        if (isLoggedIn) {
            // 加载便签待办设置
            try {
                const config = await dataManager.getDashboardConfig();
                const todosSettings = config.todosSettings || {
                    title: '便签待办',
                    visible: true,
                    opacity: 0.1,
                    mainColor: '#8b5cf6'
                };

                // 应用标题
                const todosTitleElement = document.getElementById('todos-title');
                if (todosTitleElement) {
                    const titleText = todosSettings.title || '便签待办';
                    // 不显示固定图标
                    todosTitleElement.textContent = titleText;
                    // 添加双击钉住功能
                    window.bindTodosTitleDoubleClick();
                }

                // 应用显示/隐藏状态
                todosSection.style.display = todosSettings.visible !== false ? 'block' : 'none';
            } catch (error) {
                console.error('[Todos] Load settings error:', error);
                todosSection.style.display = 'block'; // 默认显示
            }

            // 强制设置固定位置（左侧悬浮停靠），避免移动到中间
            todosSection.style.position = 'fixed';
            todosSection.style.left = '0';
            todosSection.style.right = 'auto';
            todosSection.style.top = '260px';
            todosSection.style.width = '320px';
            todosSection.style.transform = 'translateX(-310px)'; // 默认收起，只露出10px
            todosSection.style.transition = 'transform 0.3s ease-out';
            todosSection.style.overflow = 'visible';
            todosSection.style.zIndex = '20';
            todosSection.style.pointerEvents = 'auto';

            // 添加鼠标悬停事件，确保滑出功能正常工作
            todosSection.addEventListener('mouseenter', function () {
                this.style.transform = 'translateX(0)';
            });
            todosSection.addEventListener('mouseleave', function () {
                this.style.transform = 'translateX(-310px)';
            });

            // 更新配置缓存
            await updateTodosConfigCache();

            await loadTodos();
            // 不再加载保存的位置（待办面板固定位置）
            // loadTodosPosition 函数现在也会强制设置固定位置
            if (window.loadTodosPosition && typeof window.loadTodosPosition === 'function') {
                await window.loadTodosPosition();
            }
        } else {
            console.log('[Todos] User not logged in, hiding todos section');
            todosSection.style.display = 'none';
        }
    } catch (error) {
        console.error('[Todos] Init error:', error);
        todosSection.style.display = 'none';
    }
}

// 绑定便签待办标题的双击事件（钉住/取消固定）
window.bindTodosTitleDoubleClick = function () {
    return bindTodosTitleDoubleClickImpl();
}

// 切换便签待办面板的完全折叠状态（已废弃，保留用于兼容）
window.toggleTodosCollapse = function () {
    todosCollapsed = !todosCollapsed;
    applyTodosCollapse();
};

// 切换便签待办面板的钉住状态（双击后钉住，不再悬浮停靠）
window.toggleTodosPin = function () {
    todosPinned = !todosPinned;
    applyTodosPin();
};

// 应用便签待办面板的钉住状态
function applyTodosPin() {
    const todosSection = document.getElementById('todos-section');
    const todosTitleElement = document.getElementById('todos-title');

    if (!todosSection) return;

    if (todosPinned) {
        // 钉住：固定在当前位置，移除悬浮停靠效果
        todosSection.style.transform = 'translateX(0)';
        todosSection.style.transition = 'none';
        todosSection.classList.add('todos-pinned');

        // 移除hover事件监听器（如果存在）
        todosSection.onmouseenter = null;
        todosSection.onmouseleave = null;

        // 更新标题，不添加图标（移除固定图标）
        if (todosTitleElement) {
            const currentText = todosTitleElement.textContent;
            // 移除所有可能的图标标记和特殊字符，使用更完善的清理函数
            const textWithoutMarkers = cleanTodosTitle(currentText);
            todosTitleElement.textContent = textWithoutMarkers;
        }
    } else {
        // 取消钉住：恢复悬浮停靠模式
        todosSection.style.transform = 'translateX(-310px)';
        todosSection.style.transition = 'transform 0.3s ease-out';
        todosSection.classList.remove('todos-pinned');

        // 重新添加hover事件监听器
        todosSection.addEventListener('mouseenter', function () {
            if (!todosPinned) {
                this.style.transform = 'translateX(0)';
            }
        });
        todosSection.addEventListener('mouseleave', function () {
            if (!todosPinned) {
                this.style.transform = 'translateX(-310px)';
            }
        });

        // 更新标题，移除钉住指示器（取消📍图标）
        if (todosTitleElement) {
            const currentText = todosTitleElement.textContent;
            // 移除所有可能的图标标记和特殊字符，使用更完善的清理函数
            const textWithoutMarkers = cleanTodosTitle(currentText);
            // 未钉住时不显示图标
            todosTitleElement.textContent = textWithoutMarkers;
        }
    }

    updateTodosPinTooltip();
}

// 清理便签标题文本，移除所有图标和特殊字符
window.cleanTodosTitle = function (text) {
    if (!text) return '便签待办';
    // 移除所有可能的图标标记（包括emoji、问号等）
    // 使用更全面的正则表达式匹配各种可能的图标
    let cleaned = text.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}❓?▶▼📌📍]\s*/gu, '').trim();
    // 如果还有问号或其他特殊字符在开头，再次清理
    cleaned = cleaned.replace(/^[❓?]\s*/g, '').trim();
    // 确保返回的文本不为空
    return cleaned || '便签待办';
};

// 更新钉住状态提示文字
function updateTodosPinTooltip() {
    const todosTitleElement = document.getElementById('todos-title');
    if (!todosTitleElement) return;

    todosTitleElement.title = todosPinned ? '双击取消固定' : '双击固定位置';
}

// 应用便签待办面板的折叠状态
function applyTodosCollapse() {
    const todosListContainer = document.getElementById('todos-list');
    const toggleButton = document.getElementById('todos-toggle-button');
    const todosTitleElement = document.getElementById('todos-title');
    const btnAddTodo = document.getElementById('btn-add-todo');

    if (todosCollapsed) {
        // 折叠：隐藏所有内容，只显示标题
        if (todosListContainer) {
            todosListContainer.style.display = 'none';
        }
        if (toggleButton) {
            toggleButton.style.display = 'none';
        }
        if (btnAddTodo) {
            btnAddTodo.style.display = 'none';
        }

        // 更新标题，添加折叠指示器
        if (todosTitleElement) {
            const currentText = todosTitleElement.textContent;
            // 移除所有可能的图标标记和特殊字符，使用更完善的清理函数
            const textWithoutMarkers = cleanTodosTitle(currentText);
            todosTitleElement.textContent = `▶ ${textWithoutMarkers}`;
        }
    } else {
        // 展开：显示所有内容
        if (todosListContainer) {
            todosListContainer.style.display = 'flex';
        }
        if (toggleButton && todosList.length > 5) {
            toggleButton.style.display = 'block';
        }
        if (btnAddTodo) {
            btnAddTodo.style.display = 'flex';
        }

        // 更新标题，添加展开指示器（取消📍图标）
        if (todosTitleElement) {
            const currentText = todosTitleElement.textContent;
            // 移除所有可能的图标标记和特殊字符，使用更完善的清理函数
            const textWithoutMarkers = cleanTodosTitle(currentText);
            // 未钉住时不显示图标
            todosTitleElement.textContent = textWithoutMarkers;
        }
    }
}

// 加载待办事项
async function loadTodos() {
    try {
        console.log('[Todos] Loading todos...');
        const isLoggedIn = await dataManager.isLoggedIn();
        if (!isLoggedIn) {
            console.warn('[Todos] User not logged in, cannot load todos');
            todosList = [];
            await renderTodos();
            return;
        }

        todosList = await dataManager.getTodos();

        // 确保每个待办项都有原始索引（用于恢复位置）
        todosList.forEach((todo, index) => {
            if (todo.originalIndex === undefined) {
                todo.originalIndex = index;
            }
        });

        console.log('[Todos] Loaded', todosList.length, 'todos');
        await renderTodos();
        enableTodosDrag(); // 启用拖拽功能
    } catch (error) {
        console.error('[Todos] Load error:', error);
        console.error('[Todos] Error details:', {
            message: error.message,
            name: error.name
        });
        todosList = [];
        await renderTodos();
    }
}

// 待办项颜色映射（确保同一待办项总是相同颜色）
const todoColorMap = {};

// 预定义的待办项背景颜色（柔和的颜色，透明度降低50%：从0.2降到0.1）
const todoColors = [
    'rgba(139, 92, 246, 0.1)',   // 紫色
    'rgba(59, 130, 246, 0.1)',   // 蓝色
    'rgba(16, 185, 129, 0.1)',   // 绿色
    'rgba(245, 158, 11, 0.1)',   // 黄色
    'rgba(239, 68, 68, 0.1)',    // 红色
    'rgba(236, 72, 153, 0.1)',   // 粉色
    'rgba(14, 165, 233, 0.1)',   // 天蓝色
    'rgba(34, 197, 94, 0.1)',    // 浅绿色
    'rgba(251, 146, 60, 0.1)',   // 橙色
    'rgba(168, 85, 247, 0.1)',   // 紫罗兰
    'rgba(99, 102, 241, 0.1)',   // 靛蓝
    'rgba(20, 184, 166, 0.1)',   // 青绿色
];

// 便签待办配置缓存（避免每次渲染都异步获取）
let todosConfigCache = {
    mainColor: '#8b5cf6',
    opacity: 0.1
};

// 更新便签待办配置缓存
async function updateTodosConfigCache() {
    try {
        const config = await dataManager.getDashboardConfig();
        if (config.todosSettings) {
            todosConfigCache.mainColor = config.todosSettings.mainColor || todosConfigCache.mainColor;
            todosConfigCache.opacity = config.todosSettings.opacity !== undefined ? config.todosSettings.opacity : todosConfigCache.opacity;
        }
    } catch (error) {
        console.error('[Todos] Get config error:', error);
    }
}

// 渲染待办事项
async function renderTodos() {
    const todosListContainer = document.getElementById('todos-list');
    if (!todosListContainer) return;

    if (todosList.length === 0) {
        todosListContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.75rem; text-align: center; padding: 0.5rem;">暂无待办事项</div>';
        // 隐藏展开/收起按钮
        const toggleButton = document.getElementById('todos-toggle-button');
        if (toggleButton) toggleButton.style.display = 'none';
        return;
    }

    // 获取配置中的主颜色和透明度（同步获取，避免异步问题）
    let mainColor = '#8b5cf6';
    let opacity = 0.1;

    try {
        const config = await dataManager.getDashboardConfig();
        if (config.todosSettings) {
            mainColor = config.todosSettings.mainColor || mainColor;
            opacity = config.todosSettings.opacity !== undefined ? config.todosSettings.opacity : opacity;
        }
    } catch (error) {
        console.error('[Todos] Get config error:', error);
    }

    // 将主颜色转换为RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // 根据主颜色和透明度生成待办项颜色（更鲜艳的随机色）
    function generateTodoColor(todoId, baseColor, baseOpacity) {
        // 为待办项生成一个稳定的颜色（基于ID哈希）
        let hash = 0;
        const idStr = String(todoId);
        for (let i = 0; i < idStr.length; i++) {
            hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
        }

        // 使用更鲜艳的预定义颜色数组，基于hash选择
        const vibrantColors = [
            { r: 139, g: 92, b: 246 },   // 紫色
            { r: 59, g: 130, b: 246 },   // 蓝色
            { r: 16, g: 185, b: 129 },   // 绿色
            { r: 245, g: 158, b: 11 },   // 黄色
            { r: 239, g: 68, b: 68 },    // 红色
            { r: 236, g: 72, b: 153 },   // 粉色
            { r: 14, g: 165, b: 233 },   // 天蓝色
            { r: 34, g: 197, b: 94 },    // 浅绿色
            { r: 251, g: 146, b: 60 },   // 橙色
            { r: 168, g: 85, b: 247 },   // 紫罗兰
            { r: 99, g: 102, b: 241 },   // 靛蓝
            { r: 20, g: 184, b: 166 },   // 青绿色
            { r: 249, g: 115, b: 22 },   // 橙红色
            { r: 147, g: 51, b: 234 },   // 深紫色
            { r: 37, g: 99, b: 235 },    // 深蓝色
            { r: 5, g: 150, b: 105 },    // 深绿色
        ];

        const colorIndex = Math.abs(hash) % vibrantColors.length;
        const selectedColor = vibrantColors[colorIndex];

        // 使用适中的透明度（0.15，降低一半）使颜色更柔和
        const enhancedOpacity = Math.max(0.15, baseOpacity * 1.5);

        return `rgba(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b}, ${enhancedOpacity})`;
    }

    // 决定显示哪些待办事项
    const maxVisible = 5;
    const shouldShowToggle = todosList.length > maxVisible;
    const visibleTodos = todosExpanded ? todosList : todosList.slice(0, maxVisible);

    todosListContainer.innerHTML = visibleTodos.map((todo, visibleIndex) => {
        // 获取原始索引（用于操作）
        // 如果展开，visibleTodos就是todosList，索引相同
        // 如果未展开，visibleTodos是todosList.slice(0, 5)，索引对应关系不变
        // 为了更安全，从todosList中找到对应的索引
        const actualIndex = todosList.findIndex(t =>
            (t.id && t.id === todo.id) ||
            (!t.id && !todo.id && t.text === todo.text && t.completed === todo.completed)
        );
        const finalIndex = actualIndex >= 0 ? actualIndex : visibleIndex;
        const todoColor = generateTodoColor(todo.id || finalIndex.toString(), mainColor, opacity);
        const hasImage = todo.image && todo.image.trim() !== '';
        const imageIconHtml = hasImage ? `<span class="todo-image-icon" data-todo-index="${finalIndex}" style="color: var(--accent-color); font-size: 0.875rem; cursor: pointer; flex-shrink: 0; padding: 0.25rem;" title="双击查看图片">🖼️</span>` : '';
        return `
        <div class="todo-item" data-todo-index="${finalIndex}" data-todo-id="${todo.id || finalIndex}" 
            style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: ${todoColor}; border-radius: 0.375rem; ${todo.completed ? 'opacity: 0.6;' : ''} cursor: move; position: relative; user-select: none;">
            <span class="todo-drag-handle" style="color: var(--text-secondary); font-size: 0.875rem; cursor: move; user-select: none; line-height: 1; flex-shrink: 0;">⋮⋮</span>
            <input type="checkbox" class="todo-checkbox" data-todo-index="${finalIndex}" ${todo.completed ? 'checked' : ''} 
                style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-color); flex-shrink: 0;">
            <span style="flex: 1; font-size: 0.875rem; color: var(--text-primary); ${todo.completed ? 'text-decoration: line-through;' : ''}">${escapeHtml(todo.text)}</span>
            ${imageIconHtml}
            <button class="todo-delete-btn" data-todo-index="${finalIndex}" 
                style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 0.875rem; padding: 0.25rem; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">×</button>
        </div>
    `;
    }).join('');

    // 显示/隐藏展开/收起按钮
    const toggleButton = document.getElementById('todos-toggle-button');
    if (toggleButton) {
        if (shouldShowToggle) {
            toggleButton.style.display = 'block';
            toggleButton.innerHTML = todosExpanded
                ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">收起 ▲</span>`
                : `<span style="font-size: 0.75rem; color: var(--text-secondary);">展开更多 (${todosList.length - maxVisible} 项) ▼</span>`;
        } else {
            toggleButton.style.display = 'none';
        }
    }

    // 应用折叠状态（如果折叠了，隐藏内容）
    applyTodosCollapse();

    // 渲染后启用拖拽（如果未折叠）
    if (!todosCollapsed) {
        enableTodosDrag();
    }

    // 绑定事件监听器（避免内联事件处理器，符合CSP）
    bindTodoEvents(todosListContainer);
}

// 绑定待办事项事件监听器（符合CSP）
// 使用单一事件委托，避免重复绑定
let todoEventHandlersBound = false;

function bindTodoEvents(container) {
    // 只绑定一次事件监听器，使用事件委托处理所有待办项
    if (todoEventHandlersBound) {
        return; // 已经绑定过，不再重复绑定
    }

    // 使用事件委托处理复选框变化
    container.addEventListener('change', (e) => {
        if (e.target.classList.contains('todo-checkbox')) {
            e.stopPropagation();
            e.preventDefault();
            const checkbox = e.target;
            const todoItem = checkbox.closest('.todo-item');
            if (todoItem) {
                const index = parseInt(todoItem.getAttribute('data-todo-index'));
                if (!isNaN(index) && index >= 0 && index < todosList.length && window.toggleTodo) {
                    // 防止快速点击导致多次触发
                    if (checkbox.dataset.processing === 'true') {
                        return;
                    }
                    checkbox.dataset.processing = 'true';
                    window.toggleTodo(index).finally(() => {
                        checkbox.dataset.processing = 'false';
                    });
                }
            }
        }
    }, true); // 使用捕获阶段，确保先处理

    // 使用事件委托处理删除按钮点击
    container.addEventListener('click', (e) => {
        // 阻止复选框的点击事件冒泡
        if (e.target.classList.contains('todo-checkbox')) {
            e.stopPropagation();
            return;
        }

        // 处理删除按钮
        if (e.target.classList.contains('todo-delete-btn')) {
            e.stopPropagation();
            e.preventDefault();
            const btn = e.target;
            const todoItem = btn.closest('.todo-item');
            if (todoItem) {
                const index = parseInt(todoItem.getAttribute('data-todo-index'));
                if (!isNaN(index) && index >= 0 && index < todosList.length && window.deleteTodo) {
                    // 防止快速点击导致多次触发
                    if (btn.dataset.processing === 'true') {
                        return;
                    }
                    btn.dataset.processing = 'true';
                    window.deleteTodo(index).finally(() => {
                        btn.dataset.processing = 'false';
                    });
                }
            }
        }
    }, true); // 使用捕获阶段

    // 处理图片图标双击（仅双击，不响应单击）
    container.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('todo-image-icon')) {
            e.stopPropagation();
            e.preventDefault();
            const icon = e.target;
            const index = parseInt(icon.getAttribute('data-todo-index'));
            if (!isNaN(index) && index >= 0 && index < todosList.length && window.showTodoImageModal) {
                window.showTodoImageModal(index);
            }
        }
    });

    // 处理右键菜单（编辑）
    container.addEventListener('contextmenu', (e) => {
        const todoItem = e.target.closest('.todo-item');
        if (todoItem && !e.target.classList.contains('todo-checkbox') && !e.target.classList.contains('todo-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(todoItem.getAttribute('data-todo-index'));
            if (!isNaN(index) && index >= 0 && index < todosList.length && window.editTodo) {
                window.editTodo(index);
            }
        }
    });

    // 阻止复选框和删除按钮的 mousedown 事件冒泡
    container.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('todo-checkbox') || e.target.classList.contains('todo-delete-btn')) {
            e.stopPropagation();
        }
    }, true); // 使用捕获阶段

    todoEventHandlersBound = true;
}

// 切换待办事项展开/收起状态
window.toggleTodosExpanded = async function () {
    todosExpanded = !todosExpanded;
    await renderTodos();
};

// 回到顶部
window.scrollToTop = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 初始化右侧导航的滚动显示/隐藏功能
let rightNavScrollHandler = null;

function initRightNavScroll() {
    const rightNav = document.getElementById('right-nav-container');
    if (!rightNav) return;

    // 如果已经存在监听器，先移除避免重复绑定
    if (rightNavScrollHandler) {
        window.removeEventListener('scroll', rightNavScrollHandler);
    }

    let ticking = false;

    rightNavScrollHandler = function () {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrollY = window.scrollY || window.pageYOffset;
                const scrollThreshold = 200; // 滚动200px后显示

                if (scrollY > scrollThreshold) {
                    // 向下滚动超过阈值，显示右侧导航（完整界面）
                    rightNav.classList.add('show');
                } else {
                    // 回到顶部，隐藏右侧导航
                    rightNav.classList.remove('show');
                }

                ticking = false;
            });
            ticking = true;
        }
    };

    // 监听滚动事件
    window.addEventListener('scroll', rightNavScrollHandler, { passive: true });

    // 初始检查
    rightNavScrollHandler();
}

// 显示添加待办输入框（中心弹窗）
window.showAddTodoInput = function () {
    const { modal, input } = getAddTodoModalElements();

    if (modal && input) {
        bindAddTodoModalEvents();
        modal.style.display = 'flex';
        input.focus();
        setAddTodoImageState('');
    }
};

window.hideAddTodoInput = function () {
    const { modal, input } = getAddTodoModalElements();

    if (modal && input) {
        modal.style.display = 'none';
        input.value = '';
        setAddTodoImageState('');
    }
};

window.handleTodoInputKeydown = function (event) {
    if (event.key === 'Enter') {
        addTodo();
    } else if (event.key === 'Escape') {
        hideAddTodoInput();
    }
};

// 处理添加待办时的图片粘贴
function handleAddTodoImagePaste(e) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageData = event.target.result;
                setAddTodoImageState(imageData);
            };
            reader.readAsDataURL(file);
            break;
        }
    }
}

// 添加待办事项
window.addTodo = async function () {
    const { input, modal } = getAddTodoModalElements();
    if (!input || !modal) return;

    const text = input.value.trim();
    const imageData = modal.dataset?.todoImage || '';

    // 允许只有文字或只有图片
    if (!text && !imageData) {
        alert('请输入待办事项内容或粘贴图片');
        return;
    }

    const newTodo = {
        id: Date.now().toString(),
        text: text || '',
        image: imageData,
        completed: false,
        createdAt: new Date().toISOString(),
        originalIndex: todosList.filter(t => !t.completed).length // 新待办项放在未完成部分的末尾
    };

    // 添加到未完成部分的开头（置顶）
    // 找到第一个已完成待办项的索引，如果没有则添加到开头
    const firstCompletedIndex = todosList.findIndex(t => t.completed);
    if (firstCompletedIndex === -1) {
        // 没有已完成的待办项，直接添加到开头
        todosList.unshift(newTodo);
    } else {
        // 有已完成的待办项，插入到第一个已完成待办项之前（未完成部分的开头）
        todosList.splice(firstCompletedIndex, 0, newTodo);
    }

    // 更新所有未完成待办项的 originalIndex（因为新项插入了）
    todosList.forEach((todo, index) => {
        if (!todo.completed) {
            todo.originalIndex = index;
        }
    });

    await saveTodos();
    await renderTodos();
    hideAddTodoInput();
};

// 切换待办事项完成状态
window.toggleTodo = async function (index) {
    // 验证索引有效性
    if (index < 0 || index >= todosList.length) {
        console.error('[toggleTodo] Invalid index:', index, 'todosList length:', todosList.length);
        return;
    }

    const todo = todosList[index];
    if (!todo) {
        console.error('[toggleTodo] Todo not found at index:', index);
        return;
    }

    const wasCompleted = todo.completed;

    // 切换完成状态
    todo.completed = !todo.completed;

    // 分离未完成和已完成的待办项（不包括当前待办项）
    const incompleteTodos = todosList.filter((t, i) => i !== index && !t.completed);
    const completedTodos = todosList.filter((t, i) => i !== index && t.completed);

    if (todo.completed) {
        // 如果完成，移动到已完成部分的末尾
        completedTodos.push(todo);
        todosList.length = 0;
        todosList.push(...incompleteTodos, ...completedTodos);
    } else {
        // 如果取消完成，恢复到原始位置（在未完成部分）
        // 如果原始索引有效且在范围内，恢复到原始位置
        if (todo.originalIndex !== undefined && todo.originalIndex < incompleteTodos.length) {
            incompleteTodos.splice(todo.originalIndex, 0, todo);
        } else {
            // 如果原始索引无效或超出范围，添加到未完成部分的末尾
            incompleteTodos.push(todo);
        }

        todosList.length = 0;
        todosList.push(...incompleteTodos, ...completedTodos);

        // 更新未完成待办项的原始索引
        todosList.forEach((t, i) => {
            if (!t.completed) {
                t.originalIndex = i;
            }
        });
    }

    await saveTodos();
    await renderTodos();
};

// 删除待办事项
window.deleteTodo = async function (index) {
    if (index >= 0 && index < todosList.length) {
        todosList.splice(index, 1);
        await saveTodos();
        await renderTodos();
    }
};

// 编辑待办事项
window.editTodo = function (index) {
    if (index < 0 || index >= todosList.length) return;

    const todo = todosList[index];
    showTodoEditModal(todo, index);
};

// 显示待办事项编辑模态框
function getTodoEditModalElements() {
    return {
        editModal: document.getElementById('todo-edit-modal'),
        textarea: document.getElementById('todo-edit-text'),
        closeBtn: document.getElementById('todo-edit-modal-close'),
        cancelBtn: document.getElementById('todo-edit-modal-cancel'),
        saveBtn: document.getElementById('todo-edit-modal-save'),
        imagePreview: document.getElementById('todo-edit-image-preview'),
        imageDisplay: document.getElementById('todo-edit-image-display'),
        iconContainer: document.getElementById('todo-edit-image-icon-container'),
        removeImageBtn: document.getElementById('todo-edit-image-remove'),
    };
}

function setTodoEditImageState(imageData) {
    const {
        editModal,
        imagePreview,
        imageDisplay,
        iconContainer,
    } = getTodoEditModalElements();

    if (!editModal) {
        return;
    }

    const hasImage = !!(imageData && imageData.trim() !== '');
    editModal.dataset.todoImage = hasImage ? imageData : '';

    if (imageDisplay) {
        imageDisplay.src = hasImage ? imageData : '';
    }
    if (imagePreview) {
        imagePreview.style.display = hasImage ? 'block' : 'none';
    }
    if (iconContainer) {
        iconContainer.style.display = hasImage ? 'block' : 'none';
    }
}

function getTodoEditState() {
    const { editModal, textarea } = getTodoEditModalElements();
    const currentIndex = editModal ? Number.parseInt(editModal.dataset.todoIndex, 10) : NaN;

    return {
        editModal,
        textarea,
        currentIndex,
    };
}

function focusTodoEditTextarea() {
    const { textarea } = getTodoEditModalElements();
    if (textarea) {
        setTimeout(() => textarea.focus(), 100);
    }
}

function bindTodoEditModalEvents(editModal) {
    const {
        closeBtn,
        cancelBtn,
        saveBtn,
        textarea,
        removeImageBtn,
    } = getTodoEditModalElements();

    if (closeBtn) {
        closeBtn.addEventListener('click', hideTodoEditModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideTodoEditModal);
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveTodoEdit();
        });
    }

    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            hideTodoEditModal();
        }
    });

    if (textarea) {
        textarea.addEventListener('paste', handleTodoImagePaste);
    }

    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', () => {
            setTodoEditImageState('');
        });
    }
}

// 显示待办事项编辑模态框
function ensureTodoEditModal() {
    const { editModal } = getTodoEditModalElements();
    if (editModal) {
        return editModal;
    }

    const createdModal = document.createElement('div');
    createdModal.id = 'todo-edit-modal';
    createdModal.className = 'todo-edit-modal';
    createdModal.innerHTML = `
        <div class="todo-edit-modal-content">
            <div class="todo-edit-modal-header">
                <h3>\u7f16\u8f91\u5f85\u529e\u4e8b\u9879</h3>
                <button class="todo-edit-modal-close" id="todo-edit-modal-close">\u00d7</button>
            </div>
            <div class="todo-edit-modal-body">
                <textarea id="todo-edit-text" class="todo-edit-text" placeholder="\u8f93\u5165\u5f85\u529e\u4e8b\u9879\u5185\u5bb9..." rows="4"></textarea>
                <div class="todo-edit-image-preview" id="todo-edit-image-preview" style="display: none;">
                    <img id="todo-edit-image-display" src="" alt="\u9884\u89c8\u56fe\u7247" style="max-width: 100%; max-height: 200px; border-radius: 0.375rem; margin-top: 0.5rem;">
                    <button class="todo-edit-image-remove" id="todo-edit-image-remove" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #ef4444; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.75rem;">\u5220\u9664\u56fe\u7247</button>
                </div>
                <div class="todo-edit-image-icon-container" id="todo-edit-image-icon-container" style="display: none;">
                    <span style="color: var(--accent-color); font-size: 0.875rem;">\u5df2\u6dfb\u52a0\u56fe\u7247</span>
                </div>
            </div>
            <div class="todo-edit-modal-footer">
                <button class="todo-edit-modal-save" id="todo-edit-modal-save">\u4fdd\u5b58</button>
                <button class="todo-edit-modal-cancel" id="todo-edit-modal-cancel">\u53d6\u6d88</button>
            </div>
        </div>
    `;
    document.body.appendChild(createdModal);
    bindTodoEditModalEvents(createdModal);

    return createdModal;
}

function showTodoEditModal(todo, index) {
    const editModal = ensureTodoEditModal();

    const { textarea } = getTodoEditState();

    if (textarea) {
        textarea.value = todo.text || '';
    }

    setTodoEditImageState(todo.image || '');

    editModal.dataset.todoIndex = index;
    editModal.style.display = 'flex';
    focusTodoEditTextarea();
}

// 隐藏待办事项编辑模态框
function hideTodoEditModal() {
    const { editModal } = getTodoEditModalElements();
    if (editModal) {
        editModal.style.display = 'none';
    }
}

// 处理图片粘贴
function handleTodoImagePaste(e) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageData = event.target.result;
                setTodoEditImageState(imageData);
            };
            reader.readAsDataURL(file);
            break;
        }
    }
}

// 保存待办事项编辑
async function saveTodoEdit() {
    const { editModal, textarea, currentIndex } = getTodoEditState();

    if (!editModal || !textarea || Number.isNaN(currentIndex) || currentIndex < 0 || currentIndex >= todosList.length) return;

    const text = textarea.value.trim();
    if (!text && !editModal.dataset.todoImage) {
        alert('请输入待办事项内容或添加图片');
        return;
    }

    const todo = todosList[currentIndex];
    todo.text = text || '';
    todo.image = editModal.dataset.todoImage || '';

    await saveTodos();
    await renderTodos();
    hideTodoEditModal();
}

// 显示待办事项图片浮窗
window.showTodoImageModal = function (index) {
    return showTodoImageModalImpl(index);
};

// 启用待办项拖拽功能
function enableTodosDrag() {
    const todoItems = document.querySelectorAll('#todos-list .todo-item');

    todoItems.forEach((item) => {
        // 移除旧的事件监听器
        item.removeEventListener('dragstart', handleTodoDragStart);
        item.removeEventListener('dragend', handleTodoDragEnd);
        item.removeEventListener('dragover', handleTodoDragOver);
        item.removeEventListener('drop', handleTodoDrop);

        // 更新 data-todo-index（确保索引正确）
        const index = todosList.findIndex(t => (t.id || '') === (item.dataset.todoId || ''));
        if (index >= 0) {
            item.dataset.todoIndex = index;
        }

        // 设置可拖拽
        item.setAttribute('draggable', 'true');
        item.style.cursor = 'move';

        // 添加事件监听器
        item.addEventListener('dragstart', handleTodoDragStart);
        item.addEventListener('dragend', handleTodoDragEnd);
        item.addEventListener('dragover', handleTodoDragOver);
        item.addEventListener('drop', handleTodoDrop);

        // 拖拽手柄点击时开始拖拽
        const dragHandle = item.querySelector('.todo-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                // 可以在这里触发拖拽，或者让用户手动拖拽
            });
        }
    });
}

// 待办项拖拽相关变量
let draggedTodoItem = null;
let draggedTodoIndex = -1;

// 处理待办项拖拽开始
function handleTodoDragStart(e) {
    // 如果点击的是复选框、删除按钮，取消拖拽
    if (e.target.tagName === 'INPUT' || (e.target.tagName === 'BUTTON' && e.target.textContent === '×')) {
        e.preventDefault();
        return false;
    }

    draggedTodoItem = this;
    draggedTodoIndex = parseInt(this.dataset.todoIndex);

    if (isNaN(draggedTodoIndex) || draggedTodoIndex < 0 || draggedTodoIndex >= todosList.length) {
        e.preventDefault();
        return false;
    }

    this.style.opacity = '0.5';
    this.classList.add('dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTodoIndex.toString());
}

// 处理待办项拖拽结束
function handleTodoDragEnd(e) {
    if (draggedTodoItem) {
        draggedTodoItem.style.opacity = '';
        draggedTodoItem.classList.remove('dragging', 'drag-over');
    }
    draggedTodoItem = null;
    draggedTodoIndex = -1;

    // 移除所有拖拽悬停效果
    document.querySelectorAll('#todos-list .todo-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// 处理待办项拖拽悬停
function handleTodoDragOver(e) {
    e.preventDefault();
    e.stopPropagation();

    if (draggedTodoItem && this !== draggedTodoItem) {
        this.classList.add('drag-over');
    }
}

// 处理待办项放置
async function handleTodoDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTodoItem || this === draggedTodoItem) {
        return;
    }

    const targetIndex = parseInt(this.dataset.todoIndex);
    const sourceIndex = draggedTodoIndex;

    if (isNaN(sourceIndex) || isNaN(targetIndex) ||
        sourceIndex === targetIndex ||
        sourceIndex < 0 || targetIndex < 0 ||
        sourceIndex >= todosList.length || targetIndex >= todosList.length) {
        return;
    }

    // 移动待办项
    const draggedTodo = todosList[sourceIndex];
    todosList.splice(sourceIndex, 1);

    // 计算插入位置（如果源索引小于目标索引，目标索引需要减1，因为已经移除了源项）
    let insertIndex = targetIndex;
    if (sourceIndex < targetIndex) {
        insertIndex = targetIndex; // 索引不变（因为已经移除了一项）
    }

    todosList.splice(insertIndex, 0, draggedTodo);

    // 更新未完成待办项的原始索引
    const incompleteCount = todosList.filter(t => !t.completed).length;
    todosList.forEach((todo, index) => {
        if (!todo.completed && index < incompleteCount) {
            todo.originalIndex = index;
        }
    });

    // 保存并重新渲染
    await saveTodos();
    await renderTodos();
}

// 保存待办事项
async function saveTodos() {
    try {
        // 检查是否已登录
        const isLoggedIn = await dataManager.isLoggedIn();
        if (!isLoggedIn) {
            console.error('Save todos failed: User not logged in');
            alert('保存失败：请先登录');
            return;
        }

        // 检查数据格式
        if (!Array.isArray(todosList)) {
            console.error('Save todos failed: todosList is not an array', todosList);
            alert('保存失败：数据格式错误');
            return;
        }

        await dataManager.saveTodos(todosList);
        console.log('Todos saved successfully:', todosList.length, 'items');
    } catch (error) {
        console.error('Save todos error:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });

        // 提供更详细的错误信息
        let errorMessage = '保存待办事项失败';
        if (error.message) {
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                errorMessage = '保存失败：请先登录';
            } else if (error.message.includes('无法连接到服务器')) {
                errorMessage = '保存失败：无法连接到服务器，请确保服务器正在运行';
            } else {
                errorMessage = `保存失败：${error.message}`;
            }
        }
        alert(errorMessage);
    }
}

// HTML 转义辅助函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 绑定favicon图片的错误处理（符合CSP，不使用内联事件处理器）
function bindFaviconErrorHandlers(container) {
    if (!container) return;

    // 查找所有favicon图片（包括Google的各种favicon服务）
    const faviconImgs = container.querySelectorAll('img[src*="favicon"], img[src*="google.com/s2"], img[src*="gstatic.com"], img[src*="faviconV2"]');

    faviconImgs.forEach(img => {
        // 如果已经绑定过，跳过
        if (img.dataset.faviconBound === 'true') return;
        img.dataset.faviconBound = 'true';

        // 查找fallback图标
        let fallbackSpan = img.nextElementSibling;
        if (!fallbackSpan || fallbackSpan.tagName !== 'SPAN') {
            // 如果没有fallback，创建一个
            fallbackSpan = document.createElement('span');
            fallbackSpan.textContent = '🔗';
            fallbackSpan.style.display = 'none';
            img.parentNode.insertBefore(fallbackSpan, img.nextSibling);
        }

        // 绑定错误处理（静默处理，不显示错误）
        img.addEventListener('error', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.style.display = 'none';
            if (fallbackSpan) {
                fallbackSpan.style.display = 'inline';
            }
            // 阻止默认的错误行为
            return false;
        }, true);

        // 绑定加载检查
        img.addEventListener('load', function () {
            if (this.naturalWidth === 0 || this.naturalHeight === 0) {
                this.dispatchEvent(new Event('error'));
            }
        });
    });
}

// 加载常用标签栏（Top10）
async function loadFrequentBookmarks() {
    try {
        const topBookmarks = await dataManager.getTopBookmarks(10);
        const container = document.getElementById('frequent-bookmarks-list');
        const section = document.getElementById('frequent-bookmarks-bar');

        if (!container || !section) return;

        // 检查登录状态，未登录时不显示
        const isLoggedIn = await dataManager.isLoggedIn();
        if (!isLoggedIn) {
            section.style.display = 'none';
            return;
        }

        // 常驻显示，即使没有数据也显示
        section.style.display = 'block';

        // 如果没有常用书签，显示空状态
        if (!topBookmarks || topBookmarks.length === 0) {
            container.innerHTML = '<div class="frequent-empty-state">暂无上帝的指引，点击书签后会自动显示</div>';
            return;
        }

        let html = '';
        topBookmarks.forEach((bookmark) => {
            // 严格限制为10个字符，超出截断
            const displayName = bookmark.name.length > 10 ? bookmark.name.substring(0, 10) : bookmark.name;

            // 使用保存的logo或默认图标（不使用内联事件处理器）
            // 兼容旧数据：如果logo来自 gstatic/faviconV2，改用当前的 getFaviconUrl 或回退到emoji
            let logoUrl = bookmark.logo || '';
            if (isLegacyGoogleFaviconUrl(logoUrl)) {
                const fixedUrl = getFaviconUrl(bookmark.url);
                logoUrl = fixedUrl || '';
            }

            const iconHtml = logoUrl
                ? `<img src="${escapeHtml(logoUrl)}" width="16" height="16" style="vertical-align: middle;">`
                : '';
            const fallbackIcon = logoUrl ? '' : (bookmark.icon || '🔗');
            html += `
                <a href="${escapeHtml(bookmark.url)}" target="_blank" class="frequent-bookmark-item" title="${escapeHtml(bookmark.name)} (点击 ${bookmark.count} 次)">
                    <span class="frequent-bookmark-icon">${iconHtml}<span style="display: ${bookmark.logo ? 'none' : 'inline'}">${getBookmarkPlainIcon(fallbackIcon, '🔗')}</span></span>
                    <span class="frequent-bookmark-name">${escapeHtml(displayName)}</span>
                </a>
            `;
        });

        container.innerHTML = html;

        // 绑定favicon错误处理（符合CSP）
        setTimeout(() => {
            bindFaviconErrorHandlers(container);
        }, 0);

        // 上帝的指引标题颜色固定为紫色渐变，不再跟随卡片主题色
        // updateFrequentHeaderColor(); // 已禁用，使用固定的紫色渐变
    } catch (error) {
        console.error('Load frequent bookmarks error:', error);
        const container = document.getElementById('frequent-bookmarks-list');
        if (container) {
            container.innerHTML = '<div class="frequent-empty-state">加载失败，请刷新页面</div>';
        }
    }
}

// 更新上帝的指引标题颜色为第一个书签卡片的颜色（已禁用，使用固定的紫色渐变）
function updateFrequentHeaderColor() {
    // 已禁用：上帝的指引标题颜色固定为紫色渐变，不再跟随卡片主题色
    // const firstBookmarkCard = document.querySelector('#bookmarks-container .bookmark-card');
    // if (firstBookmarkCard) {
    //     const cardColor = firstBookmarkCard.dataset.customColor || '#8b5cf6';
    //     const headerH3 = document.querySelector('.frequent-bar-header h3');
    //     if (headerH3) {
    //         headerH3.style.color = cardColor;
    //     }
    // }
}

// 暴露到全局
window.updateFrequentHeaderColor = updateFrequentHeaderColor;

// 检查是否是本地URL
function isLocalUrl(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        return domain === 'localhost' ||
            domain === '127.0.0.1' ||
            domain.startsWith('192.168.') ||
            domain.startsWith('10.') ||
            domain.startsWith('172.') ||
            domain === '0.0.0.0';
    } catch (e) {
        return false;
    }
}

// 获取网站favicon
function getFaviconUrlLegacy(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        // 跳过本地URL（localhost、127.0.0.1、本地IP等）
        if (isLocalUrl(url)) {
            return null;
        }

        // 使用Google的favicon服务
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
        return null;
    }
}

// 更新书签的logo
async function updateBookmarkLogo(url, name, catIndex, itemIndex) {
    try {
        const faviconUrl = getFaviconUrl(url);
        if (!faviconUrl) return;

        const bookmarks = await dataManager.getBookmarks();
        if (bookmarks && bookmarks[catIndex] && bookmarks[catIndex].items[itemIndex]) {
            const bookmark = bookmarks[catIndex].items[itemIndex];

            // 如果logo已存在且相同，不更新
            if (bookmark.logo === faviconUrl) return;

            // 更新logo
            bookmark.logo = faviconUrl;

            // 如果icon是emoji，保留；如果是img标签，更新src（不使用内联事件处理器）
            if (bookmark.icon && bookmark.icon.includes('<img')) {
                // 更新img标签的src
                bookmark.icon = `<img src="${faviconUrl}" width="16" height="16" style="vertical-align: middle;">`;
            } else {
                // 如果icon是emoji，添加logo但保留emoji作为fallback
                bookmark.icon = `<img src="${faviconUrl}" width="16" height="16" style="vertical-align: middle;">`;
            }

            // 保存更新
            await dataManager.saveBookmarks(bookmarks);

            // 重新加载书签显示
            loadBookmarks();
        }
    } catch (error) {
        console.error('Update bookmark logo error:', error);
    }
}

function isLegacyGoogleFaviconUrl(url) {
    return typeof url === 'string' && (
        url.includes('google.com/s2/favicons') ||
        url.includes('gstatic.com') ||
        url.includes('faviconV2')
    );
}

function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);

        if (isLocalUrl(url)) {
            return null;
        }

        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return null;
        }

        return `/api/favicon?url=${encodeURIComponent(urlObj.toString())}`;
    } catch (e) {
        return null;
    }
}

function buildBookmarkFaviconImg(url, fallbackIcon = '🔗') {
    const faviconUrl = getFaviconUrl(url);
    if (!faviconUrl) {
        return fallbackIcon;
    }

    return `<img src="${escapeHtml(faviconUrl)}" width="16" height="16" style="vertical-align: middle;">`;
}

function getBookmarkPlainIcon(iconValue, fallbackIcon = '🔗') {
    if (typeof iconValue !== 'string' || !iconValue.trim()) {
        return fallbackIcon;
    }

    if (iconValue.includes('<')) {
        return fallbackIcon;
    }

    return iconValue;
}

function sanitizeBookmarkIconHtml(iconHtml) {
    if (typeof iconHtml !== 'string' || !iconHtml.includes('<img')) {
        return '';
    }

    return iconHtml
        .replace(/onerror="[^"]*"/gi, '')
        .replace(/onload="[^"]*"/gi, '')
        .replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '')
        .trim();
}

let bookmarkHoverPreviewTimer = null;
let activeBookmarkHoverWrapper = null;
let bookmarkHoverPreviewElement = null;
let duplicateBookmarkCheckTimer = null;
let duplicateBookmarkPromptActive = false;
let duplicateBookmarkMergeInProgress = false;
let duplicateBookmarkDismissedSignature = '';

function ensureBookmarkHoverPreview() {
    if (bookmarkHoverPreviewElement) {
        return bookmarkHoverPreviewElement;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'bookmark-hover-preview';
    tooltip.innerHTML = `
        <div class="bookmark-hover-preview-name"></div>
        <div class="bookmark-hover-preview-url"></div>
    `;
    document.body.appendChild(tooltip);
    bookmarkHoverPreviewElement = tooltip;
    return tooltip;
}

function hideBookmarkHoverPreview() {
    if (bookmarkHoverPreviewTimer) {
        clearTimeout(bookmarkHoverPreviewTimer);
        bookmarkHoverPreviewTimer = null;
    }

    activeBookmarkHoverWrapper = null;

    if (bookmarkHoverPreviewElement) {
        bookmarkHoverPreviewElement.classList.remove('show');
    }
}

function showBookmarkHoverPreview(wrapper) {
    if (!wrapper) return;

    const name = wrapper.dataset.bookmarkName || '';
    const url = wrapper.dataset.bookmarkUrl || '';
    if (!name && !url) return;

    const tooltip = ensureBookmarkHoverPreview();
    tooltip.querySelector('.bookmark-hover-preview-name').textContent = name;
    tooltip.querySelector('.bookmark-hover-preview-url').textContent = url;

    const rect = wrapper.getBoundingClientRect();
    const tooltipWidth = Math.min(360, Math.max(240, Math.round(window.innerWidth * 0.28)));
    tooltip.style.width = `${tooltipWidth}px`;
    tooltip.style.left = `${Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, rect.left + (rect.width / 2) - (tooltipWidth / 2)))}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - 12, rect.bottom + 10)}px`;
    tooltip.classList.add('show');
}

function bindBookmarkHoverPreview(container) {
    if (!container || container.dataset.bookmarkHoverPreviewBound === 'true') {
        return;
    }

    container.dataset.bookmarkHoverPreviewBound = 'true';

    container.addEventListener('mouseover', (event) => {
        const wrapper = event.target.closest('.bookmark-item-wrapper');
        if (!wrapper || !container.contains(wrapper) || wrapper === activeBookmarkHoverWrapper) {
            return;
        }

        activeBookmarkHoverWrapper = wrapper;
        if (bookmarkHoverPreviewTimer) {
            clearTimeout(bookmarkHoverPreviewTimer);
        }

        bookmarkHoverPreviewTimer = setTimeout(() => {
            if (activeBookmarkHoverWrapper === wrapper) {
                showBookmarkHoverPreview(wrapper);
            }
        }, 1000);
    });

    container.addEventListener('mouseout', (event) => {
        const wrapper = event.target.closest('.bookmark-item-wrapper');
        if (!wrapper || !container.contains(wrapper)) {
            return;
        }

        if (event.relatedTarget && wrapper.contains(event.relatedTarget)) {
            return;
        }

        if (activeBookmarkHoverWrapper === wrapper) {
            hideBookmarkHoverPreview();
        }
    });

    container.addEventListener('click', () => {
        hideBookmarkHoverPreview();
    });

    window.addEventListener('scroll', hideBookmarkHoverPreview, { passive: true });
    window.addEventListener('resize', hideBookmarkHoverPreview);
}

function normalizeDuplicateBookmarkName(name) {
    return typeof name === 'string' ? name.trim() : '';
}

function normalizeDuplicateBookmarkUrl(url) {
    return typeof url === 'string' ? url.trim() : '';
}

function collectDuplicateBookmarkGroups(bookmarks) {
    const duplicateMap = new Map();

    (Array.isArray(bookmarks) ? bookmarks : []).forEach((category, catIndex) => {
        const categoryName = category?.category || '未分类';
        (Array.isArray(category?.items) ? category.items : []).forEach((item, itemIndex) => {
            if (!item || !item.url) return;

            const normalizedName = normalizeDuplicateBookmarkName(item.name);
            const normalizedUrl = normalizeDuplicateBookmarkUrl(item.url);
            if (!normalizedName || !normalizedUrl) return;

            const duplicateKey = `${normalizedName}\n${normalizedUrl}`;
            if (!duplicateMap.has(duplicateKey)) {
                duplicateMap.set(duplicateKey, {
                    name: normalizedName,
                    url: normalizedUrl,
                    entries: []
                });
            }

            duplicateMap.get(duplicateKey).entries.push({
                catIndex,
                itemIndex,
                categoryName,
                item
            });
        });
    });

    return Array.from(duplicateMap.values())
        .filter(group => group.entries.length > 1);
}

function buildDuplicateBookmarkSignature(groups) {
    return groups
        .map(group => `${group.name}\n${group.url}:${group.entries.map(entry => `${entry.categoryName}/${entry.item.name || ''}`).join(',')}`)
        .sort()
        .join('|');
}

function mergeDuplicateBookmarksInPlace(bookmarks) {
    const groups = collectDuplicateBookmarkGroups(bookmarks);
    if (!groups.length) {
        return { bookmarks, groupsMerged: 0, duplicatesRemoved: 0, removedEntries: [] };
    }

    let duplicatesRemoved = 0;
    const removedEntries = [];

    groups.forEach(group => {
        const [firstEntry, ...duplicateEntries] = group.entries;
        if (!firstEntry) return;

        const primaryItem = bookmarks[firstEntry.catIndex]?.items?.[firstEntry.itemIndex];
        if (!primaryItem) return;

        duplicateEntries.forEach(entry => {
            const duplicateItem = bookmarks[entry.catIndex]?.items?.[entry.itemIndex];
            if (!duplicateItem) return;

            if ((!primaryItem.name || primaryItem.name.length < duplicateItem.name.length) && duplicateItem.name) {
                primaryItem.name = duplicateItem.name;
            }
            if ((!primaryItem.icon || primaryItem.icon === '🔗') && duplicateItem.icon) {
                primaryItem.icon = duplicateItem.icon;
            }
            if (!primaryItem.logo && duplicateItem.logo) {
                primaryItem.logo = duplicateItem.logo;
            }
        });

        duplicateEntries
            .sort((a, b) => {
                if (a.catIndex !== b.catIndex) {
                    return b.catIndex - a.catIndex;
                }
                return b.itemIndex - a.itemIndex;
            })
            .forEach(entry => {
                const items = bookmarks[entry.catIndex]?.items;
                if (!Array.isArray(items)) return;
                removedEntries.push({
                    url: entry.item?.url || '',
                    name: entry.item?.name || '',
                    category: entry.categoryName || '',
                    folderPath: entry.item?.folderPath || entry.categoryName || ''
                });
                items.splice(entry.itemIndex, 1);
                duplicatesRemoved++;
            });
    });

    return {
        bookmarks,
        groupsMerged: groups.length,
        duplicatesRemoved,
        removedEntries
    };
}

function getStableDuplicateBookmarkCategoryName(category) {
    return normalizeDuplicateBookmarkName(category?.category) || '未分类';
}

function getStableDuplicateBookmarkSourceFolder(item, categoryName) {
    const folderPath = normalizeDuplicateBookmarkName(item?.folderPath);
    return folderPath || categoryName;
}

function createStableDuplicateBookmarkEntryId(name, url, categoryName, sourceFolder, occurrenceIndex) {
    return [
        normalizeDuplicateBookmarkName(name),
        normalizeDuplicateBookmarkUrl(url),
        normalizeDuplicateBookmarkName(categoryName),
        normalizeDuplicateBookmarkName(sourceFolder),
        String(occurrenceIndex || 1)
    ].join('\u0001');
}

function cloneBookmarksForStableDuplicateMerge(bookmarks) {
    return (Array.isArray(bookmarks) ? bookmarks : []).map(category => ({
        ...category,
        items: (Array.isArray(category?.items) ? category.items : []).map(item => ({ ...item }))
    }));
}

function collectDuplicateBookmarkGroupsStable(bookmarks) {
    const duplicateMap = new Map();
    const entryOccurrenceMap = new Map();

    (Array.isArray(bookmarks) ? bookmarks : []).forEach((category) => {
        const categoryName = getStableDuplicateBookmarkCategoryName(category);
        (Array.isArray(category?.items) ? category.items : []).forEach((item) => {
            if (!item || !item.url) return;

            const normalizedName = normalizeDuplicateBookmarkName(item.name);
            const normalizedUrl = normalizeDuplicateBookmarkUrl(item.url);
            if (!normalizedName || !normalizedUrl) return;

            const sourceFolder = getStableDuplicateBookmarkSourceFolder(item, categoryName);
            const occurrenceKey = [
                normalizedName,
                normalizedUrl,
                categoryName,
                sourceFolder
            ].join('\u0001');
            const occurrenceIndex = (entryOccurrenceMap.get(occurrenceKey) || 0) + 1;
            entryOccurrenceMap.set(occurrenceKey, occurrenceIndex);

            const groupKey = `${normalizedName}\u0001${normalizedUrl}`;
            if (!duplicateMap.has(groupKey)) {
                duplicateMap.set(groupKey, {
                    name: normalizedName,
                    url: normalizedUrl,
                    groupKey,
                    entries: []
                });
            }

            duplicateMap.get(groupKey).entries.push({
                entryId: createStableDuplicateBookmarkEntryId(
                    normalizedName,
                    normalizedUrl,
                    categoryName,
                    sourceFolder,
                    occurrenceIndex
                ),
                categoryName,
                folderPath: sourceFolder,
                item: { ...item }
            });
        });
    });

    return Array.from(duplicateMap.values()).filter(group => group.entries.length > 1);
}

function buildDefaultDuplicateRemovalSelectionStable(groups) {
    const selectedEntryIds = [];

    (Array.isArray(groups) ? groups : []).forEach(group => {
        group.entries.slice(1).forEach(entry => {
            selectedEntryIds.push(entry.entryId);
        });
    });

    return selectedEntryIds;
}

function mergeDuplicateBookmarksBySelectionStable(bookmarks, selectedEntryIds) {
    const selectedEntryIdSet = selectedEntryIds instanceof Set
        ? selectedEntryIds
        : new Set(Array.isArray(selectedEntryIds) ? selectedEntryIds : []);

    if (selectedEntryIdSet.size === 0) {
        return {
            bookmarks: cloneBookmarksForStableDuplicateMerge(bookmarks),
            groupsMerged: 0,
            duplicatesRemoved: 0,
            removedEntries: []
        };
    }

    const clonedBookmarks = cloneBookmarksForStableDuplicateMerge(bookmarks);
    const entryOccurrenceMap = new Map();
    const mergedGroupKeys = new Set();
    let duplicatesRemoved = 0;
    const removedEntries = [];

    clonedBookmarks.forEach(category => {
        const categoryName = getStableDuplicateBookmarkCategoryName(category);
        const nextItems = [];

        (Array.isArray(category?.items) ? category.items : []).forEach(item => {
            if (!item || !item.url) {
                nextItems.push(item);
                return;
            }

            const normalizedName = normalizeDuplicateBookmarkName(item.name);
            const normalizedUrl = normalizeDuplicateBookmarkUrl(item.url);
            if (!normalizedName || !normalizedUrl) {
                nextItems.push(item);
                return;
            }

            const sourceFolder = getStableDuplicateBookmarkSourceFolder(item, categoryName);
            const occurrenceKey = [
                normalizedName,
                normalizedUrl,
                categoryName,
                sourceFolder
            ].join('\u0001');
            const occurrenceIndex = (entryOccurrenceMap.get(occurrenceKey) || 0) + 1;
            entryOccurrenceMap.set(occurrenceKey, occurrenceIndex);

            const entryId = createStableDuplicateBookmarkEntryId(
                normalizedName,
                normalizedUrl,
                categoryName,
                sourceFolder,
                occurrenceIndex
            );

            if (selectedEntryIdSet.has(entryId)) {
                removedEntries.push({
                    url: item.url || '',
                    name: item.name || '',
                    category: categoryName || '',
                    folderPath: sourceFolder || categoryName || ''
                });
                duplicatesRemoved += 1;
                mergedGroupKeys.add(`${normalizedName}\u0001${normalizedUrl}`);
                return;
            }

            nextItems.push(item);
        });

        category.items = nextItems;
    });

    return {
        bookmarks: clonedBookmarks,
        groupsMerged: mergedGroupKeys.size,
        duplicatesRemoved,
        removedEntries
    };
}

async function showDuplicateBookmarkMergeModalStable(groups) {
    const defaultSelectedIds = buildDefaultDuplicateRemovalSelectionStable(groups);
    const selectedEntryIds = new Set(defaultSelectedIds);

    return new Promise((resolve) => {
        let isClosed = false;
        let keyHandler = null;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'custom-modal-overlay show duplicate-merge-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'custom-modal duplicate-merge-modal';

        const renderGroupHtml = (group, groupIndex) => {
            const entriesHtml = group.entries.map((entry, entryIndex) => {
                const isSelected = selectedEntryIds.has(entry.entryId);
                const displayName = entry.item?.name || group.name || '未命名书签';
                const displayUrl = entry.item?.url || group.url || '';
                const defaultBadge = entryIndex === 0
                    ? '<span class="duplicate-merge-badge duplicate-merge-badge-keep">默认保留</span>'
                    : '<span class="duplicate-merge-badge duplicate-merge-badge-delete">默认删除</span>';

                return `
                    <label class="duplicate-merge-entry ${isSelected ? 'is-selected' : ''}" data-entry-id="${escapeHtml(entry.entryId)}" data-group-index="${groupIndex}">
                        <input type="checkbox" class="duplicate-merge-checkbox" data-entry-id="${escapeHtml(entry.entryId)}" ${isSelected ? 'checked' : ''}>
                        <div class="duplicate-merge-entry-content">
                            <div class="duplicate-merge-entry-title-row">
                                <span class="duplicate-merge-entry-name">${escapeHtml(displayName)}</span>
                                ${defaultBadge}
                            </div>
                            <div class="duplicate-merge-entry-url">${escapeHtml(displayUrl)}</div>
                            <div class="duplicate-merge-entry-meta">
                                <span class="duplicate-merge-badge">分类：${escapeHtml(entry.categoryName || '未分类')}</span>
                                <span class="duplicate-merge-badge">来源文件夹：${escapeHtml(entry.folderPath || entry.categoryName || '未分类')}</span>
                            </div>
                        </div>
                    </label>
                `;
            }).join('');

            return `
                <section class="duplicate-merge-group" data-group-index="${groupIndex}">
                    <div class="duplicate-merge-group-header">
                        <div>
                            <div class="duplicate-merge-group-name">${escapeHtml(group.name || '未命名书签')}</div>
                            <div class="duplicate-merge-group-url">${escapeHtml(group.url || '')}</div>
                        </div>
                        <span class="duplicate-merge-group-count">${group.entries.length} 条</span>
                    </div>
                    <div class="duplicate-merge-entry-list">
                        ${entriesHtml}
                    </div>
                    <div class="duplicate-merge-group-warning" data-group-warning="${groupIndex}"></div>
                </section>
            `;
        };

        modal.innerHTML = `
            <div class="duplicate-merge-modal-header">
                <div>
                    <h3>合并书签对比</h3>
                    <p>默认保留每组第一条书签。你可以勾选要删除的条目，来源分类和文件夹都会单独标出。</p>
                </div>
                <button type="button" class="duplicate-merge-close-btn" aria-label="关闭">&times;</button>
            </div>
            <div class="duplicate-merge-summary" id="duplicate-merge-summary"></div>
            <div class="duplicate-merge-groups">
                ${groups.map(renderGroupHtml).join('')}
            </div>
            <div class="modal-actions duplicate-merge-actions">
                <button type="button" class="btn btn-secondary" id="duplicate-merge-reset">恢复默认选择</button>
                <button type="button" class="btn btn-secondary" id="duplicate-merge-cancel">取消</button>
                <button type="button" class="btn" id="duplicate-merge-confirm">执行合并</button>
            </div>
        `;

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);

        const summaryEl = modal.querySelector('#duplicate-merge-summary');
        const confirmBtn = modal.querySelector('#duplicate-merge-confirm');
        const cancelBtn = modal.querySelector('#duplicate-merge-cancel');
        const resetBtn = modal.querySelector('#duplicate-merge-reset');
        const closeBtn = modal.querySelector('.duplicate-merge-close-btn');
        const groupEls = Array.from(modal.querySelectorAll('.duplicate-merge-group'));

        const closeModal = (result) => {
            if (isClosed) {
                return false;
            }

            isClosed = true;
            if (keyHandler) {
                document.removeEventListener('keydown', keyHandler);
            }
            if (modalOverlay.parentNode) {
                document.body.removeChild(modalOverlay);
            }
            resolve(result);
            return true;
        };

        const updateSelectionState = () => {
            let selectedCount = 0;
            let invalidGroups = 0;

            groupEls.forEach((groupEl, groupIndex) => {
                const group = groups[groupIndex];
                const warningEl = groupEl.querySelector(`[data-group-warning="${groupIndex}"]`);
                const keptCount = group.entries.filter(entry => !selectedEntryIds.has(entry.entryId)).length;
                const groupSelectedCount = group.entries.length - keptCount;

                groupEl.classList.toggle('is-invalid', keptCount === 0);
                if (warningEl) {
                    warningEl.textContent = keptCount === 0 ? '这一组至少保留 1 条书签。' : '';
                }

                if (keptCount === 0) {
                    invalidGroups += 1;
                }

                selectedCount += groupSelectedCount;
            });

            modal.querySelectorAll('.duplicate-merge-entry').forEach(entryEl => {
                const entryId = entryEl.getAttribute('data-entry-id');
                entryEl.classList.toggle('is-selected', selectedEntryIds.has(entryId));
            });

            if (summaryEl) {
                summaryEl.textContent = `共发现 ${groups.length} 组重复书签，当前选中删除 ${selectedCount} 条。`;
            }

            if (confirmBtn) {
                confirmBtn.disabled = invalidGroups > 0;
            }
        };

        const syncCheckboxState = () => {
            modal.querySelectorAll('.duplicate-merge-checkbox').forEach(checkbox => {
                const entryId = checkbox.getAttribute('data-entry-id');
                checkbox.checked = selectedEntryIds.has(entryId);
            });
            updateSelectionState();
        };

        modal.querySelectorAll('.duplicate-merge-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const entryId = event.target.getAttribute('data-entry-id');
                if (!entryId) {
                    return;
                }

                if (event.target.checked) {
                    selectedEntryIds.add(entryId);
                } else {
                    selectedEntryIds.delete(entryId);
                }

                updateSelectionState();
            });
        });

        if (resetBtn) {
            resetBtn.onclick = () => {
                selectedEntryIds.clear();
                defaultSelectedIds.forEach(entryId => selectedEntryIds.add(entryId));
                syncCheckboxState();
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                closeModal({ confirmed: false, selectedEntryIds: [] });
            };
        }

        if (closeBtn) {
            closeBtn.onclick = () => {
                closeModal({ confirmed: false, selectedEntryIds: [] });
            };
        }

        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const hasInvalidGroup = groups.some(group => group.entries.every(entry => selectedEntryIds.has(entry.entryId)));
                if (hasInvalidGroup) {
                    updateSelectionState();
                    return;
                }

                closeModal({
                    confirmed: true,
                    selectedEntryIds: Array.from(selectedEntryIds)
                });
            };
        }

        modalOverlay.onclick = (event) => {
            if (event.target === modalOverlay) {
                closeModal({ confirmed: false, selectedEntryIds: [] });
            }
        };

        keyHandler = (event) => {
            if (event.key === 'Escape') {
                closeModal({ confirmed: false, selectedEntryIds: [] });
            }
        };
        document.addEventListener('keydown', keyHandler);

        updateSelectionState();
        setTimeout(() => {
            if (confirmBtn) {
                confirmBtn.focus();
            }
        }, 50);
    });
}

async function syncMergedDuplicateBookmarksToBrowser(removedEntries) {
    if (!Array.isArray(removedEntries) || removedEntries.length === 0) {
        return;
    }

    for (const entry of removedEntries) {
        if (!entry || !entry.url) {
            continue;
        }

        try {
            if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.deleteBookmarkExact === 'function') {
                await window.godsBookmarkExtension.deleteBookmarkExact(
                    entry.url,
                    entry.name || '',
                    entry.category || '',
                    entry.folderPath || ''
                );
            } else {
                window.postMessage({
                    type: 'DELETE_BOOKMARK_EXACT',
                    bookmark: {
                        url: entry.url,
                        name: entry.name || '',
                        category: entry.category || '',
                        folderPath: entry.folderPath || ''
                    }
                }, '*');
            }
        } catch (error) {
            console.error('[书签查重] 同步删除浏览器重复书签失败:', entry, error);
        }
    }
}

async function syncBrowserBookmarksFromServer() {
    try {
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.syncServerBookmarks === 'function') {
            if (typeof window.godsBookmarkExtension.isReady === 'function' &&
                !window.godsBookmarkExtension.isReady()) {
                return;
            }
            await window.godsBookmarkExtension.syncServerBookmarks();
        }
    } catch (error) {
        console.error('[书签查重] 触发浏览器全量对账失败:', error);
    }
}

async function mergeBookmarksManually() {
    if (duplicateBookmarkPromptActive || duplicateBookmarkMergeInProgress) {
        return;
    }

    const bookmarks = await dataManager.getBookmarks();
    const duplicateGroups = collectDuplicateBookmarkGroups(bookmarks);

    if (!duplicateGroups.length) {
        await showCustomAlert('未发现可合并书签。', '合并书签');
        return;
    }

    duplicateBookmarkPromptActive = true;
    const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.entries.length - 1, 0);
    const shouldMerge = await showCustomConfirm(
        `发现 ${duplicateGroups.length} 组可合并书签，共 ${duplicateCount} 条重复项。\n是否开始合并？\n\n合并规则：仅当书签名称和 URL 都相同，才会合并，并保留首次出现的位置。`,
        '合并书签'
    );
    duplicateBookmarkPromptActive = false;

    if (!shouldMerge) {
        return;
    }

    duplicateBookmarkMergeInProgress = true;
    try {
        const latestBookmarks = await dataManager.getBookmarks();
        const mergedResult = mergeDuplicateBookmarksInPlace(latestBookmarks);
        if (mergedResult.duplicatesRemoved <= 0) {
            await showCustomAlert('未发现可合并书签。', '合并书签');
            return;
        }

        await dataManager.saveBookmarks(mergedResult.bookmarks);
        await syncMergedDuplicateBookmarksToBrowser(mergedResult.removedEntries);
        await syncBrowserBookmarksFromServer();
        duplicateBookmarkDismissedSignature = '';
        await loadBookmarks();
        await showCustomAlert(
            `已合并 ${mergedResult.groupsMerged} 组书签，移除 ${mergedResult.duplicatesRemoved} 条重复项。`,
            '合并书签完成'
        );
    } finally {
        duplicateBookmarkMergeInProgress = false;
    }
}

window.mergeBookmarksManually = mergeBookmarksManually;

async function mergeBookmarksManuallyStable() {
    if (duplicateBookmarkPromptActive || duplicateBookmarkMergeInProgress) {
        return;
    }

    const bookmarks = await getBookmarksForInteractiveAction();
    const duplicateGroups = collectDuplicateBookmarkGroupsStable(bookmarks);

    if (!duplicateGroups.length) {
        await showCustomAlert('未发现可合并书签。', '合并书签');
        return;
    }

    duplicateBookmarkPromptActive = true;
    const mergeSelection = await showDuplicateBookmarkMergeModalStable(duplicateGroups);
    duplicateBookmarkPromptActive = false;

    if (!mergeSelection?.confirmed) {
        return;
    }

    if (!Array.isArray(mergeSelection.selectedEntryIds) || mergeSelection.selectedEntryIds.length === 0) {
        await showCustomAlert('未选择要删除的重复书签。', '合并书签');
        return;
    }

    duplicateBookmarkMergeInProgress = true;
    try {
        const latestBookmarks = getBookmarksMemoryCache();
        const mergedResult = mergeDuplicateBookmarksBySelectionStable(latestBookmarks, mergeSelection.selectedEntryIds);
        if (mergedResult.duplicatesRemoved <= 0) {
            await showCustomAlert('未发现可执行的合并项，书签列表可能已经变化，请重新打开合并书签。', '合并书签');
            return;
        }

        updateBookmarksMemoryCache(mergedResult.bookmarks);
        markLocalRealtimeBrowserSyncWindow();
        await dataManager.saveBookmarks(mergedResult.bookmarks);
        await syncMergedDuplicateBookmarksToBrowser(mergedResult.removedEntries);
        duplicateBookmarkDismissedSignature = '';
        await loadBookmarks();
        await showCustomAlert(
            `已合并 ${mergedResult.groupsMerged} 组书签，移除 ${mergedResult.duplicatesRemoved} 条重复项。`,
            '合并书签完成'
        );
    } finally {
        duplicateBookmarkMergeInProgress = false;
    }
}

window.mergeBookmarksManually = mergeBookmarksManuallyStable;

async function checkDuplicateBookmarksAndPrompt() {
    if (duplicateBookmarkPromptActive || duplicateBookmarkMergeInProgress) {
        return;
    }

    const bookmarks = await dataManager.getBookmarks();
    const duplicateGroups = collectDuplicateBookmarkGroups(bookmarks);

    if (!duplicateGroups.length) {
        duplicateBookmarkDismissedSignature = '';
        return;
    }

    const duplicateSignature = buildDuplicateBookmarkSignature(duplicateGroups);
    if (duplicateSignature === duplicateBookmarkDismissedSignature) {
        return;
    }

    duplicateBookmarkPromptActive = true;
    const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.entries.length - 1, 0);
    const shouldMerge = await showCustomConfirm(
        `发现 ${duplicateGroups.length} 组重复书签，共 ${duplicateCount} 条重复项。\n是否自动合并？\n\n合并规则：按网址去重，保留首次出现的位置。`,
        '检测到重复书签'
    );
    duplicateBookmarkPromptActive = false;

    if (!shouldMerge) {
        duplicateBookmarkDismissedSignature = duplicateSignature;
        return;
    }

    duplicateBookmarkMergeInProgress = true;
    try {
        const latestBookmarks = await dataManager.getBookmarks();
        const mergedResult = mergeDuplicateBookmarksInPlace(latestBookmarks);
        if (mergedResult.duplicatesRemoved > 0) {
            await dataManager.saveBookmarks(mergedResult.bookmarks);
            await syncMergedDuplicateBookmarksToBrowser(mergedResult.removedEntries);
            await syncBrowserBookmarksFromServer();
            duplicateBookmarkDismissedSignature = '';
            await loadBookmarks();
            await showCustomAlert(
                `已合并 ${mergedResult.groupsMerged} 组重复书签，移除 ${mergedResult.duplicatesRemoved} 条重复项。`,
                '重复书签已合并'
            );
        }
    } finally {
        duplicateBookmarkMergeInProgress = false;
    }
}

async function checkDuplicateBookmarksAndPromptWithStrictRule() {
    if (duplicateBookmarkPromptActive || duplicateBookmarkMergeInProgress) {
        return;
    }

    const bookmarks = await dataManager.getBookmarks();
    const duplicateGroups = collectDuplicateBookmarkGroups(bookmarks);

    if (!duplicateGroups.length) {
        duplicateBookmarkDismissedSignature = '';
        return;
    }

    const duplicateSignature = buildDuplicateBookmarkSignature(duplicateGroups);
    if (duplicateSignature === duplicateBookmarkDismissedSignature) {
        return;
    }

    duplicateBookmarkPromptActive = true;
    const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.entries.length - 1, 0);
    const shouldMerge = await showCustomConfirm(
        `发现 ${duplicateGroups.length} 组重复书签，共 ${duplicateCount} 条重复项。\n是否自动合并？\n\n合并规则：仅当书签名称和 URL 都相同，才判定为重复，并保留首次出现的位置。`,
        '检测到重复书签'
    );
    duplicateBookmarkPromptActive = false;

    if (!shouldMerge) {
        duplicateBookmarkDismissedSignature = duplicateSignature;
        return;
    }

    duplicateBookmarkMergeInProgress = true;
    try {
        const latestBookmarks = await dataManager.getBookmarks();
        const mergedResult = mergeDuplicateBookmarksInPlace(latestBookmarks);
        if (mergedResult.duplicatesRemoved > 0) {
            await dataManager.saveBookmarks(mergedResult.bookmarks);
            await syncMergedDuplicateBookmarksToBrowser(mergedResult.removedEntries);
            await syncBrowserBookmarksFromServer();
            duplicateBookmarkDismissedSignature = '';
            await loadBookmarks();
            await showCustomAlert(
                `已合并 ${mergedResult.groupsMerged} 组重复书签，移除 ${mergedResult.duplicatesRemoved} 条重复项。`,
                '重复书签已合并'
            );
        }
    } finally {
        duplicateBookmarkMergeInProgress = false;
    }
}

function scheduleDuplicateBookmarkCheck() {
    if (duplicateBookmarkCheckTimer) {
        clearTimeout(duplicateBookmarkCheckTimer);
    }

    duplicateBookmarkCheckTimer = null;
    return;

    duplicateBookmarkCheckTimer = setTimeout(() => {
        duplicateBookmarkCheckTimer = null;
        checkDuplicateBookmarksAndPromptWithStrictRule().catch(error => {
            console.error('[书签查重] 自动查重失败:', error);
        });
    }, 600);
}

async function loadBookmarks() {
    console.log('[loadBookmarks] Starting to load bookmarks...');
    const container = document.getElementById('bookmarks-container');
    if (!container) {
        console.error('[loadBookmarks] Bookmarks container not found!');
        return;
    }

    try {
        let bookmarksData = null;
        let isAdmin = false;

        try {
            console.log('[loadBookmarks] Fetching bookmarks from API...');
            bookmarksData = await dataManager.getBookmarks();
            console.log('[loadBookmarks] Bookmarks loaded:', bookmarksData?.length || 0, 'categories');

            // 如果没有数据，使用空数组而不是 null
            if (!bookmarksData) {
                console.warn('[loadBookmarks] No bookmarks data, using empty array');
                bookmarksData = [];
            }
        } catch (error) {
            console.error('[loadBookmarks] Failed to load bookmarks:', error);
            // 如果API失败，尝试使用默认数据，而不是直接返回
            console.log('[loadBookmarks] Attempting to use default bookmarks...');
            try {
                bookmarksData = dataManager.getDefaultBookmarks();
                console.log('[loadBookmarks] Using default bookmarks:', bookmarksData?.length || 0, 'categories');
            } catch (defaultError) {
                console.error('[loadBookmarks] Failed to get default bookmarks:', defaultError);
                // 如果默认数据也失败，显示错误提示
                container.innerHTML = '<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">⚠️ 无法加载书签：请确保服务器正在运行</p>';
                return;
            }
        }

        try {
            isAdmin = await dataManager.isLoggedIn();
        } catch (error) {
            console.error('Failed to check login status:', error);
            // 默认未登录状态
            isAdmin = false;
        }

        const isSettingsMode = document.getElementById('admin-sidebar')?.classList.contains('open');

        let html = '';

        // 工具栏控制代码迁移至 initGlobalUI 或在此处重新检查
        const toolbar = document.getElementById('admin-toolbar');
        if (toolbar) {
            toolbar.style.display = isAdmin ? 'flex' : 'none';
            // 管理员移动端适配
            if (isAdmin && window.innerWidth < 768) {
                toolbar.style.flexDirection = 'column';
                toolbar.style.alignItems = 'stretch';
            }
        }

        if (bookmarksData) {
            updateBookmarksMemoryCache(bookmarksData);
            // 获取配置以检查隐藏和折叠状态
            let bookmarkLayoutConfig = [];
            try {
                const config = await dataManager.getDashboardConfig();
                bookmarkLayoutConfig = config.bookmarkLayout || [];
            } catch (error) {
                console.error('获取书签布局配置失败:', error);
            }

            bookmarksData.forEach((cat, catIndex) => {
                // 查找该分类的配置
                const layoutItem = bookmarkLayoutConfig.find(item => item.category === cat.category);
                const isHidden = layoutItem?.hidden === true;
                const isCollapsed = layoutItem?.collapsed === true;

                html += `
                <div class="glass-card bookmark-card ${isCollapsed ? 'bookmark-card-collapsed' : ''}" 
                     data-category="${cat.category}" 
                     data-cat-index="${catIndex}"
                     style="${isHidden ? 'display: none !important;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 10px;">
                        <h3 class="bookmark-card-title" 
                            data-category="${cat.category}"
                            style="color: var(--accent-color); user-select: none; cursor: ${isSettingsMode ? 'default' : 'pointer'}; flex: 1; min-width: 0;" 
                            title="${isSettingsMode ? '请在右侧卡片标题双击重命名' : '双击折叠/展开'}">
                            ${cat.category}
                        </h3>
                        
                        ${isAdmin ? `
                            <button class="add-bookmark-btn" data-category-index="${catIndex}" 
                                style="background: rgba(255,255,255,0.1); border: none; cursor: pointer; color: var(--text-secondary); width: 28px; height: 28px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                                title="添加书签">
                                +
                            </button>
                        ` : ''}
                    </div>
                    <div class="bookmark-grid ${isCollapsed ? 'bookmark-grid-collapsed' : ''}" style="display: ${isCollapsed ? 'none' : 'grid'}; justify-content: center; gap: 0.75rem; transition: all 0.3s ease;">
                        ${cat.items.map((item, itemIndex) => {
                    // 限制名称显示为10个字符
                    const displayName = item.name.length > 10 ? item.name.substring(0, 10) : item.name;
                    // 优先使用保存的logo，如果没有则使用icon
                    let iconDisplay = '';

                    // 兼容旧数据：如果logo来自 gstatic/faviconV2，改用当前的 getFaviconUrl 或回退到emoji
                    let logoUrl = item.logo || '';
                    if (isLegacyGoogleFaviconUrl(logoUrl)) {
                        const fixedUrl = getFaviconUrl(item.url);
                        logoUrl = fixedUrl || '';
                    }

                    if (logoUrl) {
                        // 如果有有效的logo，使用img标签，emoji作为fallback（不使用内联事件处理器）
                        const fallbackIcon = item.icon && !item.icon.includes('<img') ? item.icon : '🔗';
                        iconDisplay = `<img src="${logoUrl}" width="16" height="16" style="vertical-align: middle;">`;
                    } else if (item.icon && item.icon.includes('<img')) {
                        // 如果icon已经是img标签，移除内联事件处理器；若仍包含 gstatic/faviconV2，则直接使用默认图标
                        let cleanedIcon = item.icon
                            .replace(/onerror="[^"]*"/g, '')
                            .replace(/onload="[^"]*"/g, '');
                        if (isLegacyGoogleFaviconUrl(cleanedIcon)) {
                            iconDisplay = '🔗';
                        } else {
                            iconDisplay = cleanedIcon;
                        }
                        if (isLegacyGoogleFaviconUrl(cleanedIcon)) {
                            iconDisplay = buildBookmarkFaviconImg(item.url, '🔗');
                        }
                    } else {
                        // 使用emoji图标
                        iconDisplay = item.icon || '🔗';
                    }
                    if (typeof iconDisplay === 'string' && iconDisplay.includes('<img')) {
                        const normalizedIconDisplay = sanitizeBookmarkIconHtml(iconDisplay);
                        if (normalizedIconDisplay) {
                            iconDisplay = normalizedIconDisplay;
                        }
                    } else {
                        iconDisplay = getBookmarkPlainIcon(iconDisplay, '🔗');
                    }

                    return `
                            <div class="bookmark-item-wrapper" style="position: relative;" data-bookmark-name="${escapeHtml(item.name)}" data-bookmark-url="${escapeHtml(item.url)}">
                                <a href="${escapeHtml(item.url)}" target="_blank" class="bookmark-item" 
                                   data-cat-index="${catIndex}" data-item-index="${itemIndex}"
                                    style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; border-radius: 0.5rem; transition: background 0.2s; width: 100%;">
                                    <span class="bookmark-icon" style="flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;">${iconDisplay}</span>
                                    <span class="bookmark-name">${escapeHtml(displayName)}</span>
                                </a>
                            </div>
                            `;
                }).join('')}
                    </div>
                    <!-- 添加书签 (均需要管理员权限 + 添加权限) -->
                    ${isAdmin ? `
                    <!-- Add Button Moved to Header -->
                    ` : ''}
                </div>
            `;
            });
        }

        // Add empty state
        if ((!bookmarksData || bookmarksData.length === 0) && !isAdmin) {
            html = '<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">暂无书签</p>';
        }

        container.innerHTML = html;
        // 绑定favicon错误处理（符合CSP）
        bindFaviconErrorHandlers(container);
        bindBookmarkHoverPreview(container);

        // Bind Events mainly for Right Click (Context Menu) and Click
        container.querySelectorAll('.bookmark-item').forEach(item => {
            const cIdx = parseInt(item.dataset.catIndex);
            const iIdx = parseInt(item.dataset.itemIndex);
            item.addEventListener('contextmenu', (e) => handleBookmarkRightClick(e, cIdx, iIdx));
            // 绑定点击事件（避免内联onclick，符合CSP）
            item.addEventListener('click', (e) => {
                // 如果正在拖拽书签，不处理点击
                if (document.body.classList.contains('is-dragging-bookmark')) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (document.body.classList.contains('sidebar-open')) {
                    const bookmarkCard = e.currentTarget.closest('.bookmark-card');
                    const cardIndex = bookmarkCard && typeof window.getCardControlIndex === 'function'
                        ? window.getCardControlIndex(bookmarkCard)
                        : -1;
                    e.preventDefault();
                    e.stopPropagation();
                    if (cardIndex >= 0 && typeof window.highlightCardControl === 'function') {
                        window.highlightCardControl(cardIndex, true, false);
                    }
                    return;
                }
                if (window.handleBookmarkClick) {
                    window.handleBookmarkClick(e, cIdx, iIdx);
                }
            });
        });

        // 绑定分类名称输入框和添加书签按钮事件（符合CSP）
        container.querySelectorAll('.category-name-input').forEach(input => {
            const catIndex = parseInt(input.getAttribute('data-category-index'));
            if (!isNaN(catIndex)) {
                input.addEventListener('change', (e) => {
                    const value = e.target.value;
                    if (window.renameCategory) {
                        window.renameCategory(catIndex, value);
                    }
                });
                input.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        });

        container.querySelectorAll('.add-bookmark-btn').forEach(btn => {
            const catIndex = parseInt(btn.getAttribute('data-category-index'));
            if (!isNaN(catIndex) && window.openAddBookmarkModal) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.openAddBookmarkModal(catIndex);
                });
            }
        });

        // 双击标题折叠/展开（仅非设置模式）
        if (!isSettingsMode) {
            container.querySelectorAll('.bookmark-card-title').forEach(title => {
                let lastClickTime = 0;
                title.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentTime = Date.now();
                    if (currentTime - lastClickTime < 300) {
                        // 双击
                        const categoryName = title.getAttribute('data-category');
                        if (categoryName && window.toggleBookmarkCardCollapse) {
                            window.toggleBookmarkCardCollapse(categoryName);
                        }
                        lastClickTime = 0;
                    } else {
                        lastClickTime = currentTime;
                    }
                });
            });
        }

        // Hover effects
        document.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.style.backgroundColor = 'rgba(255,255,255,0.05)');
            item.addEventListener('mouseleave', () => item.style.backgroundColor = 'transparent');
        });

        // 恢复书签卡片布局设置
        setTimeout(async () => {
            await restoreBookmarkStyles();
            syncBookmarkCardWidthsToContainer();
            // 恢复书签缩放比例
            if (typeof window.restoreBookmarkScale === 'function') {
                await window.restoreBookmarkScale();
            }
            // 上帝的指引标题颜色固定为紫色渐变，不再跟随卡片主题色
            // updateFrequentHeaderColor(); // 已禁用
            // 延迟渲染右侧导航，确保布局完全恢复后再生成（按实际显示顺序）
            setTimeout(() => {
                renderRightNav(); // Update nav after rendering
            }, 200);
            // 更新书签分类索引映射（供删除分类使用）
            if (typeof window.setBookmarkCategoryIndexes === 'function') {
                window.setBookmarkCategoryIndexes();
            }

            // 如果登录状态，启用书签拖拽功能
            if (isAdmin) {
                enableBookmarkDragAndDrop();
            }

            // 如果设置已打开，只为当前高亮的书签卡片挂载右下角 resize handle
            if (document.body.classList.contains('sidebar-open')) {
                const highlightedBookmarkCard = document.querySelector('#bookmarks-container .bookmark-card.highlighted-card');
                if (highlightedBookmarkCard && window.addBookmarkCardResizeHandles) {
                    window.addBookmarkCardResizeHandles(highlightedBookmarkCard);
                } else if (window.clearBookmarkCardResizeHandles) {
                    window.clearBookmarkCardResizeHandles();
                }
                if (window.enableBookmarkCardSort) {
                    window.enableBookmarkCardSort();
                }
            }

            // 检查并显示/隐藏滚动条
            clampRenderedBookmarkCardWidths();
            updateBookmarkScrollbars();
        }, 100);
    } catch (error) {
        console.error('loadBookmarks error:', error);
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">⚠️ 加载书签时发生错误：' + (error.message || '未知错误') + '</p>';
    } finally {
        // 加载书签后刷新搜索缓存
        if (typeof refreshBookmarksCache === 'function') {
            await refreshBookmarksCache();
        }
        scheduleDuplicateBookmarkCheck();
    }
}

// 设置书签分类索引映射（供 dashboard-layout.js 使用）
window.setBookmarkCategoryIndexes = async function () {
    // 这个函数会在 loadBookmarks 后调用，确保分类索引映射是最新的
    // renderCardControls 会调用 getBookmarkCategoryIndex 来获取正确的索引
};

// 启用书签拖拽功能（登录状态下）
function enableBookmarkDragAndDrop() {
    const bookmarkWrappers = document.querySelectorAll('#bookmarks-container .bookmark-item-wrapper');
    const bookmarkCards = document.querySelectorAll('#bookmarks-container .bookmark-card');
    const bookmarkGrids = document.querySelectorAll('#bookmarks-container .bookmark-grid');

    // 为每个书签项启用拖拽
    bookmarkWrappers.forEach(wrapper => {
        const bookmarkItem = wrapper.querySelector('.bookmark-item');
        if (!bookmarkItem) return;

        // 从HTML中的data属性获取索引（注意：HTML中使用的是data-cat-index和data-item-index）
        const catIndex = parseInt(bookmarkItem.getAttribute('data-cat-index'));
        const itemIndex = parseInt(bookmarkItem.getAttribute('data-item-index'));

        if (isNaN(catIndex) || isNaN(itemIndex)) return;

        // 设置为可拖拽
        wrapper.setAttribute('draggable', 'true');
        wrapper.dataset.catIndex = catIndex;
        wrapper.dataset.itemIndex = itemIndex;

        // 添加拖拽样式
        wrapper.classList.add('bookmark-draggable');

        // 移除旧的事件监听器（如果存在）
        wrapper.removeEventListener('dragstart', handleBookmarkDragStart);
        wrapper.removeEventListener('dragend', handleBookmarkDragEnd);

        // 添加拖拽事件监听器
        wrapper.addEventListener('dragstart', handleBookmarkDragStart);
        wrapper.addEventListener('dragend', handleBookmarkDragEnd);
    });

    // 为每个分类卡片添加drop区域
    bookmarkCards.forEach(card => {
        // 使用新的监听器，使用 { capture: false } 确保事件冒泡
        card.addEventListener('dragover', handleBookmarkDragOver, { passive: false });
        card.addEventListener('drop', handleBookmarkDrop, { passive: false });
        card.addEventListener('dragleave', handleBookmarkDragLeave);
    });

    // 为每个网格添加drop区域
    bookmarkGrids.forEach(grid => {
        grid.addEventListener('dragover', handleBookmarkDragOver, { passive: false });
        grid.addEventListener('drop', handleBookmarkDrop, { passive: false });
        grid.addEventListener('dragleave', handleBookmarkDragLeave);
    });

    // 为每个书签项wrapper也添加drop事件（允许拖到其他书签上插入）
    bookmarkWrappers.forEach(wrapper => {
        wrapper.addEventListener('dragover', handleBookmarkDragOver, { passive: false });
        wrapper.addEventListener('drop', handleBookmarkDrop, { passive: false });
    });
}

// 书签拖拽开始
let draggedBookmark = null;

function clearBookmarkDragIndicators() {
    document.querySelectorAll(
        '.bookmark-card.drag-over, .bookmark-grid.drag-over, .bookmark-item-wrapper.bookmark-drop-before, .bookmark-item-wrapper.bookmark-drop-after'
    ).forEach(el => {
        el.classList.remove('drag-over', 'bookmark-drop-before', 'bookmark-drop-after');
    });
}

function getBookmarkDropPosition(targetWrapper, clientY) {
    if (!targetWrapper) {
        return 'after';
    }

    const rect = targetWrapper.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    return clientY < midpoint ? 'before' : 'after';
}

function resolveBookmarkDropTarget(event, targetGrid) {
    if (!targetGrid) {
        return { targetWrapper: null, dropPosition: 'after' };
    }

    const targetWrapper = event.target.closest('.bookmark-item-wrapper');
    if (!targetWrapper || !targetGrid.contains(targetWrapper)) {
        return { targetWrapper: null, dropPosition: 'after' };
    }

    return {
        targetWrapper,
        dropPosition: getBookmarkDropPosition(targetWrapper, event.clientY)
    };
}

function updateBookmarkItemIndexesInCard(card, catIndex) {
    if (!card) {
        return;
    }

    const parsedCardIndex = parseInt(card.getAttribute('data-cat-index'), 10);
    const numericCatIndex = Number.isFinite(catIndex)
        ? catIndex
        : (Number.isFinite(parsedCardIndex) ? parsedCardIndex : 0);
    const wrappers = Array.from(card.querySelectorAll('.bookmark-grid .bookmark-item-wrapper'));

    wrappers.forEach((wrapper, itemIndex) => {
        wrapper.dataset.catIndex = numericCatIndex;
        wrapper.dataset.itemIndex = itemIndex;

        const item = wrapper.querySelector('.bookmark-item');
        if (item) {
            item.setAttribute('data-cat-index', String(numericCatIndex));
            item.setAttribute('data-item-index', String(itemIndex));
        }
    });
}

function getBookmarkCardByCategoryName(categoryName) {
    if (!categoryName) {
        return null;
    }

    return Array.from(document.querySelectorAll('#bookmarks-container .bookmark-card'))
        .find(card => card.dataset.category === categoryName) || null;
}

async function applyBookmarkMoveToDom(dragInfo, targetCategoryName, insertIndex) {
    const movedWrapper = dragInfo?.wrapper || null;
    const sourceCard = movedWrapper ? movedWrapper.closest('.bookmark-card') : null;
    const targetCard = getBookmarkCardByCategoryName(targetCategoryName);
    const targetGrid = targetCard?.querySelector('.bookmark-grid') || null;

    if (!movedWrapper || !targetCard || !targetGrid) {
        await loadBookmarks();
        return;
    }

    const sourceCategoryName = sourceCard?.dataset.category || '';
    const targetChildren = Array.from(targetGrid.querySelectorAll(':scope > .bookmark-item-wrapper'))
        .filter(wrapper => wrapper !== movedWrapper);
    const safeInsertIndex = clampNumber(insertIndex, 0, targetChildren.length);
    const referenceNode = targetChildren[safeInsertIndex] || null;

    if (referenceNode) {
        targetGrid.insertBefore(movedWrapper, referenceNode);
    } else {
        targetGrid.appendChild(movedWrapper);
    }

    movedWrapper.classList.remove('dragging', 'bookmark-drop-before', 'bookmark-drop-after');
    movedWrapper.style.removeProperty('opacity');
    movedWrapper.style.removeProperty('transform');

    const sourceCardAfterMove = sourceCategoryName ? getBookmarkCardByCategoryName(sourceCategoryName) : sourceCard;
    const sourceCatIndex = parseInt(dragInfo?.wrapper?.dataset?.catIndex || dragInfo?.catIndex, 10);
    const targetCatIndex = parseInt(targetCard.getAttribute('data-cat-index'), 10);

    updateBookmarkItemIndexesInCard(targetCard, targetCatIndex);
    if (sourceCardAfterMove && sourceCardAfterMove !== targetCard) {
        updateBookmarkItemIndexesInCard(sourceCardAfterMove, sourceCatIndex);
    }

    if (typeof refreshBookmarksCache === 'function') {
        await refreshBookmarksCache();
    }

    updateBookmarkScrollbars();
    scheduleDuplicateBookmarkCheck();
}

function handleBookmarkDragStart(e) {
    console.log('[书签拖拽] dragstart事件触发', this);

    const wrapper = this;
    const catIndex = parseInt(wrapper.dataset.catIndex);
    const itemIndex = parseInt(wrapper.dataset.itemIndex);

    draggedBookmark = {
        wrapper: wrapper,
        catIndex: catIndex,
        itemIndex: itemIndex
    };

    wrapper.classList.add('dragging');
    document.body.classList.add('is-dragging-bookmark');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    e.dataTransfer.setData('text/html', wrapper.innerHTML);

    // 阻止链接的默认行为（导航）
    e.stopPropagation();
}

// 书签拖拽结束
function handleBookmarkDragEnd(e) {
    console.log('[书签拖拽] dragend事件触发', this);

    // 清除样式，但不立即清空draggedBookmark（drop事件可能还未处理）
    if (draggedBookmark && draggedBookmark.wrapper) {
        draggedBookmark.wrapper.classList.remove('dragging');
    }

    document.body.classList.remove('is-dragging-bookmark');

    // 清除所有拖拽悬停样式
    clearBookmarkDragIndicators();

    // 延迟清空draggedBookmark，确保drop事件能访问到数据
    // drop事件会在dragend之前或之后触发，但顺序不确定，所以延迟清空更安全
    setTimeout(() => {
        draggedBookmark = null;
    }, 200);
}

// 书签拖拽悬停
function handleBookmarkDragOver(e) {
    if (!draggedBookmark) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    clearBookmarkDragIndicators();

    // 添加悬停样式
    const card = this.closest('.bookmark-card');
    const grid = this.closest('.bookmark-grid') || this;
    if (card) card.classList.add('drag-over');
    if (grid && grid !== card) grid.classList.add('drag-over');

    const { targetWrapper, dropPosition } = resolveBookmarkDropTarget(e, grid && grid.classList.contains('bookmark-grid') ? grid : card?.querySelector('.bookmark-grid'));
    if (targetWrapper && targetWrapper !== draggedBookmark.wrapper) {
        targetWrapper.classList.add(dropPosition === 'before' ? 'bookmark-drop-before' : 'bookmark-drop-after');
    }
}

// 书签拖拽离开
function handleBookmarkDragLeave(e) {
    // 只有当真正离开时才移除样式
    if (!this.contains(e.relatedTarget)) {
        const card = this.closest('.bookmark-card');
        const grid = this.closest('.bookmark-grid') || this;
        if (card) card.classList.remove('drag-over');
        if (grid) grid.classList.remove('drag-over');

        if (this.classList?.contains('bookmark-item-wrapper')) {
            this.classList.remove('bookmark-drop-before', 'bookmark-drop-after');
        }
    }
}

// 书签拖拽释放
async function handleBookmarkDrop(e) {
    console.log('[书签拖拽] drop事件触发', {
        target: e.target,
        currentTarget: e.currentTarget,
        draggedBookmark: draggedBookmark
    });

    e.preventDefault();
    e.stopPropagation();

    // 保存拖拽信息（因为dragend可能会清空draggedBookmark）
    const dragInfo = draggedBookmark;
    if (!dragInfo) {
        console.log('[书签拖拽] 没有拖拽中的书签，忽略drop');
        return;
    }

    // 查找目标卡片 - 从事件目标开始向上查找
    let targetCard = e.target.closest('.bookmark-card');
    if (!targetCard) {
        // 如果从target找不到，尝试从this找
        targetCard = this.closest ? this.closest('.bookmark-card') : null;
    }

    const targetGrid = targetCard ? targetCard.querySelector('.bookmark-grid') : null;

    // 移除悬停样式
    clearBookmarkDragIndicators();

    if (!targetCard) {
        console.log('[书签拖拽] 未找到目标卡片', e.target, this);
        return;
    }

    const targetCategoryName = targetCard.dataset.category;
    if (!targetCategoryName) {
        console.log('[书签拖拽] 目标卡片缺少分类名称', targetCard);
        return;
    }

    try {
        const bookmarks = await dataManager.getBookmarks();

        // 获取源分类和目标分类（使用保存的dragInfo）
        const srcCatIndex = dragInfo.catIndex;
        const srcItemIndex = dragInfo.itemIndex;
        const targetCatIndex = bookmarks.findIndex(cat => cat.category === targetCategoryName);

        if (targetCatIndex === -1) {
            console.error('[书签拖拽] 未找到目标分类:', targetCategoryName);
            return;
        }

        if (srcCatIndex < 0 || srcCatIndex >= bookmarks.length) {
            console.error('[书签拖拽] 源分类索引无效:', srcCatIndex);
            return;
        }

        if (srcItemIndex < 0 || srcItemIndex >= bookmarks[srcCatIndex].items.length) {
            console.error('[书签拖拽] 源书签索引无效:', srcItemIndex);
            return;
        }

        // 获取要移动的书签数据
        const itemData = bookmarks[srcCatIndex].items[srcItemIndex];

        // 确定插入位置
        let insertIndex = bookmarks[targetCatIndex].items.length; // 默认追加到尾部
        const { targetWrapper: targetBookmarkWrapper, dropPosition } = resolveBookmarkDropTarget(e, targetGrid);

        if (targetBookmarkWrapper === dragInfo.wrapper) {
            console.log('[书签拖拽] 原地不动');
            return;
        }

        if (targetBookmarkWrapper && targetGrid && targetGrid.contains(targetBookmarkWrapper)) {
            // 拖到了其他书签上，按落点前后插入
            const targetItem = targetBookmarkWrapper.querySelector('.bookmark-item');
            if (targetItem) {
                const targetCatIdx = parseInt(targetItem.getAttribute('data-cat-index'));
                const targetItemIdx = parseInt(targetItem.getAttribute('data-item-index'));

                if (!isNaN(targetCatIdx) && !isNaN(targetItemIdx) && targetCatIdx === targetCatIndex) {
                    insertIndex = targetItemIdx + (dropPosition === 'after' ? 1 : 0);

                    // 同一分类内移动时，先删除源项会让后续索引左移一位
                    if (srcCatIndex === targetCatIndex && srcItemIndex < insertIndex) {
                        insertIndex -= 1;
                    }

                    if (srcCatIndex === targetCatIndex && insertIndex === srcItemIndex) {
                        console.log('[书签拖拽] 原地不动');
                        return;
                    }

                    console.log('[书签拖拽] 插入到位置:', insertIndex, 'dropPosition:', dropPosition);
                }
            }
        } else {
            console.log('[书签拖拽] 拖到空白处，追加到尾部');
        }

        // 从源分类移除
        bookmarks[srcCatIndex].items.splice(srcItemIndex, 1);

        // 插入到目标位置
        bookmarks[targetCatIndex].items.splice(insertIndex, 0, itemData);

        // 先标记本地变更，避免自己的实时流把当前拖拽结果又刷新回去
        markLocalRealtimeBrowserSyncWindow();

        // 保存并做局部更新，避免整块书签区域重渲染
        await dataManager.saveBookmarks(bookmarks);
        updateBookmarksMemoryCache(bookmarks);
        await applyBookmarkMoveToDom(dragInfo, targetCategoryName, insertIndex);

        // 浏览器后台同步放到局部更新之后，优先保证当前页面手感稳定
        syncBookmarkMoveToBrowser(itemData.url, targetCategoryName, insertIndex).catch(error => {
            console.error('[书签拖拽] 同步书签位置到浏览器失败:', error);
        });

    } catch (error) {
        console.error('[书签拖拽] 保存失败:', error);
        console.error('[书签拖拽] 错误详情:', error.stack);
        // 恢复书签样式（使用保存的dragInfo）
        if (dragInfo && dragInfo.wrapper) {
            dragInfo.wrapper.classList.remove('dragging');
        }
        document.body.classList.remove('is-dragging-bookmark');
    } finally {
        // 延迟清空draggedBookmark，确保drop事件处理完成
        setTimeout(() => {
            draggedBookmark = null;
        }, 100);
    }
}

// Right Navigation（暴露到全局供其他模块调用）
window.renderRightNav = function () {
    renderRightNavInternal();
};

function renderRightNav() {
    renderRightNavInternal();
}

let activeRightNavCategory = null;
let bookmarkNavOutsideClickBound = false;

function setActiveRightNavCategory(categoryName) {
    activeRightNavCategory = categoryName || null;

    document.querySelectorAll('.nav-dot-wrapper').forEach(wrapper => {
        const isActive = !!activeRightNavCategory && wrapper.dataset.category === activeRightNavCategory;
        wrapper.classList.toggle('active', isActive);
    });
}

function clearBookmarkQuickNavSelection() {
    activeRightNavCategory = null;

    document.querySelectorAll('.nav-dot-wrapper.active').forEach(wrapper => {
        wrapper.classList.remove('active');
    });
    document.querySelectorAll('.highlighted-card').forEach(card => {
        card.classList.remove('highlighted-card');
    });
}

function bindBookmarkNavOutsideClick() {
    if (bookmarkNavOutsideClickBound) return;
    bookmarkNavOutsideClickBound = true;

    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('sidebar-open')) return;
        if (e.target.closest('.nav-dot-wrapper') || e.target.closest('.nav-back-to-top')) return;
        if (e.target.closest('#bookmarks-container .bookmark-card')) return;
        if (e.target.closest('#monitor-section .glass-card')) return;
        if (e.target.closest('button, a, input, textarea, select, label, [role="button"], [contenteditable="true"]')) return;

        clearBookmarkQuickNavSelection();
    });
}

function renderRightNavInternal() {
    let navContainer = document.getElementById('right-nav-container');
    if (!navContainer) {
        navContainer = document.createElement('div');
        navContainer.id = 'right-nav-container';
        navContainer.className = 'right-nav';
        document.body.appendChild(navContainer);
    }

    // Clear existing
    navContainer.innerHTML = '';

    // 添加"回到顶部"按钮（顶部）
    const backToTopBtn = document.createElement('button');
    backToTopBtn.className = 'nav-back-to-top';
    backToTopBtn.innerHTML = '▲';
    backToTopBtn.title = '回到顶部';
    backToTopBtn.onclick = () => {
        window.scrollToTop();
    };
    navContainer.appendChild(backToTopBtn);

    // Find all cards in the bookmarks container (按照DOM中的实际显示顺序)
    const bookmarksContainer = document.getElementById('bookmarks-container');
    if (!bookmarksContainer) return;

    // 按照DOM中的实际顺序获取卡片（即用户看到的顺序）
    const cards = Array.from(bookmarksContainer.querySelectorAll('.glass-card.bookmark-card'));

    cards.forEach((card, index) => {
        const catName = card.dataset.category;
        // 获取对应卡片的颜色
        const cardColor = card.dataset.customColor || '#8b5cf6';

        const wrapper = document.createElement('div');
        wrapper.className = 'nav-dot-wrapper';
        wrapper.setAttribute('data-category', catName); // 添加data-category属性，方便匹配
        wrapper.style.setProperty('--card-color', cardColor); // 设置CSS变量
        wrapper.onclick = () => {
            // 找到卡片在所有卡片中的索引
            const allCards = document.querySelectorAll('#monitor-section .glass-card, #bookmarks-container .glass-card');
            const cardIndex = Array.from(allCards).indexOf(card);

            if (cardIndex >= 0) {
                // 使用 highlightCardControl 函数，右侧设置卡片高亮不居中，左侧对应的书签卡片居中高亮，只有左侧卡片滚动
                if (window.highlightCardControl && typeof window.highlightCardControl === 'function') {
                    window.highlightCardControl(cardIndex, false, true);
                }
            } else {
                // 如果找不到索引，使用原来的滚动方式
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // Update active state
            setActiveRightNavCategory(catName);
        };

        const dot = document.createElement('div');
        dot.className = 'nav-dot';
        dot.style.background = cardColor;

        const label = document.createElement('span');
        label.className = 'nav-label';
        label.innerText = catName;
        label.style.color = cardColor;

        wrapper.appendChild(dot);
        wrapper.appendChild(label);
        navContainer.appendChild(wrapper);
        if (activeRightNavCategory && activeRightNavCategory === catName) {
            wrapper.classList.add('active');
        }
    });

    // 初始化右侧导航的滚动显示/隐藏功能
    initRightNavScroll();
    bindBookmarkNavOutsideClick();
}

// 切换监控组件显示/隐藏（保留此函数供initMonitor中的删除按钮使用）
window.toggleConfig = async function (key) {
    const config = await dataManager.getDashboardConfig();
    config[key] = !config[key];
    await dataManager.saveDashboardConfig(config);
    initMonitor();
}


/* --- Monitor Logic --- */
let monitorInterval;

async function initMonitor() {
    const config = await dataManager.getDashboardConfig();
    const isAdmin = await dataManager.isLoggedIn();

    // Toggle visibility based on config
    const updateWidget = (id, show) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = show ? 'block' : 'none';

        // Add Delete Button if Admin and not already there
        if (show && isAdmin) {
            let btn = el.querySelector('.delete-widget-btn');
            if (!btn) {
                btn = document.createElement('button');
                btn.className = 'delete-widget-btn';
                btn.innerHTML = '×';
                btn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.5rem; line-height: 0.5; padding: 5px; opacity: 0.5; transition: opacity 0.2s;';
                btn.onmouseenter = () => btn.style.opacity = '1';
                btn.onmouseleave = () => btn.style.opacity = '0.5';
                btn.title = '隐藏此卡片';

                // Determine key based on ID
                let key = '';
                if (id === 'cpu-gauge') key = 'showCpu';
                if (id === 'ram-gauge') key = 'showRam';
                if (id === 'storage-gauge') key = 'showStorage';

                btn.onclick = (e) => {
                    e.stopPropagation(); // Prevent card clicks if any
                    toggleConfig(key);
                };
                el.style.position = 'relative'; // Ensure positioning context
                el.appendChild(btn);
            }
        }
    };

    updateWidget('cpu-gauge', config.showCpu);
    updateWidget('ram-gauge', config.showRam);
    updateWidget('storage-gauge', config.showStorage);

    updateMonitorData();
    if (monitorInterval) clearInterval(monitorInterval);
    monitorInterval = setInterval(updateMonitorData, 5000);
}

async function updateMonitorData() {
    try {
        const info = await dataManager.apiRequest('/api/system', { quiet: true });
        if (!info) return;

        updateGauge('cpu-gauge', info.cpu);
        updateGauge('ram-gauge', info.ram ? info.ram.percent : 0);

        if (info.storage) {
            updateGauge('storage-gauge', info.storage.percent);
        } else {
            // 运行环境不支持磁盘统计时显示 N/A，不显示假数据
            const storageEl = document.getElementById('storage-gauge');
            const textEl = storageEl && storageEl.querySelector('.progress-text');
            if (textEl) textEl.innerText = 'N/A';
        }
    } catch (error) {
        // 请求失败时保留上一次的数值，仅记录警告
        console.warn('[Monitor] 获取系统信息失败:', error.message);
    }
}

function updateGauge(id, value) {
    const el = document.getElementById(id);
    if (!el || el.style.display === 'none') return;

    const fill = el.querySelector('.progress-fill');
    const text = el.querySelector('.progress-text');
    if (fill) fill.style.width = `${value}%`;
    if (text) text.innerText = `${value}%`;
}


/* --- Mock Editor Functions (Simplification) --- */
// In a real app these would open modals. For this demo we use prompt/confirm.

/* --- Modal Logic --- */

let currentModalState = {
    type: null, // 'add_bookmark', 'edit_bookmark', 'add_category'
    catIndex: null,
    itemIndex: null
};

// --- Category Modal ---
window.openAddCategoryModal = function () {
    currentModalState.type = 'add_category';
    document.getElementById('category-name').value = '';
    document.getElementById('category-modal').style.display = 'flex';
    document.getElementById('category-name').focus();
}

window.closeCategoryModal = function () {
    document.getElementById('category-modal').style.display = 'none';
}

window.saveCategoryFromModal = async function () {
    const name = document.getElementById('category-name').value;
    if (!name) return;

    const bookmarks = await dataManager.getBookmarks();
    bookmarks.push({ category: name, items: [] });
    await dataManager.saveBookmarks(bookmarks);

    // 同步创建浏览器文件夹
    await syncAddFolderToBrowser(name);

    closeCategoryModal();
    loadBookmarks();
}

// Global Custom Alert (shared wrapper)
window.showCustomAlert = function (message, title = '\u63d0\u793a', type = 'success') {
    return showCustomAlertImpl(message, title, type);
};
// Global Custom Confirm
window.showCustomConfirm = function (message, title = '\u786e\u8ba4\u64cd\u4f5c') {
    return showCustomConfirmImpl(message, title);
}
// 获取书签分类索引（通过分类名称）
window.getBookmarkCategoryIndex = async function (categoryName) {
    const bookmarks = await dataManager.getBookmarks();
    return bookmarks.findIndex(cat => cat.category === categoryName);
};

// 通过分类名称删除分类（更可靠的方式）
window.deleteCategoryByName = async function (categoryName) {
    const result = await showCustomConfirm("确定删除该分类吗?");
    if (!result) return;

    const bookmarks = await dataManager.getBookmarks();
    const categoryIndex = bookmarks.findIndex(cat => cat.category === categoryName);

    if (categoryIndex === -1) {
        alert('❌ 未找到该分类，无法删除');
        console.error('Category not found:', categoryName);
        return;
    }

    bookmarks.splice(categoryIndex, 1);
    await dataManager.saveBookmarks(bookmarks);

    // 同步删除浏览器文件夹
    await syncDeleteFolderToBrowser(categoryName);

    // 清理布局配置中已删除分类的数据
    const config = await dataManager.getDashboardConfig();
    if (config && config.bookmarkLayout) {
        config.bookmarkLayout = config.bookmarkLayout.filter(item => item.category !== categoryName);
        await dataManager.saveDashboardConfig(config);
    }

    // 重新加载书签
    await loadBookmarks();

    // 等待书签加载完成后再重新渲染布局设置面板
    // 使用 setTimeout 确保 DOM 已完全更新
    setTimeout(async () => {
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            if (typeof window.renderCardControls === 'function') {
                await window.renderCardControls();
            }
        }
    }, 300);
};

// 保留通过索引删除的方式（向后兼容）
window.deleteCategory = async function (categoryIndex) {
    // Replace native confirm with custom modal
    const result = await showCustomConfirm("确定删除该分类吗?");
    if (!result) return;

    const bookmarks = await dataManager.getBookmarks();

    // 验证索引有效性
    if (categoryIndex < 0 || categoryIndex >= bookmarks.length) {
        alert('❌ 分类索引无效，无法删除');
        console.error('Invalid category index:', categoryIndex, 'Total categories:', bookmarks.length);
        return;
    }

    // 获取要删除的分类名称
    const categoryName = bookmarks[categoryIndex].category;

    bookmarks.splice(categoryIndex, 1);
    await dataManager.saveBookmarks(bookmarks);

    // 同步删除浏览器文件夹
    await syncDeleteFolderToBrowser(categoryName);

    // 清理布局配置中已删除分类的数据
    const config = await dataManager.getDashboardConfig();
    if (config && config.bookmarkLayout) {
        config.bookmarkLayout = config.bookmarkLayout.filter(item => item.category !== categoryName);
        await dataManager.saveDashboardConfig(config);
    }

    // 重新加载书签
    await loadBookmarks();

    // 等待书签加载完成后再重新渲染布局设置面板
    // 使用 setTimeout 确保 DOM 已完全更新
    setTimeout(async () => {
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            if (typeof window.renderCardControls === 'function') {
                await window.renderCardControls();
            }
        }
    }, 300);
}

// --- Bookmark Modal ---
window.openAddBookmarkModal = function (catIndex) {
    currentModalState.type = 'add_bookmark';
    currentModalState.catIndex = catIndex;

    document.querySelector('#bookmark-modal h3').innerText = '添加书签';
    document.getElementById('bookmark-name').value = '';
    document.getElementById('bookmark-url').value = '';

    document.getElementById('bookmark-modal').style.display = 'flex';
    document.getElementById('bookmark-name').focus();

    // 隐藏删除按钮（新增模式）
    const delBtn = document.getElementById('modal-delete-btn');
    if (delBtn) delBtn.style.display = 'none';
}

window.closeBookmarkModal = function () {
    document.getElementById('bookmark-modal').style.display = 'none';
}

// 保存书签（从 Modal）
window.saveBookmarkFromModal = async function () {
    const name = document.getElementById('bookmark-name').value;
    let url = document.getElementById('bookmark-url').value;

    if (!name || !url) {
        alert('请填写名称和网址');
        return;
    }

    // Auto-prepend https:// if missing
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    // 自动获取 Favicon (Google S2)
    // 尝试提取域名
    let domain = url;
    try {
        const urlObj = new URL(url);
        domain = urlObj.hostname;
    } catch (e) {
        // Fallback for invalid URLs or relative paths if any
    }
    // 跳过本地URL
    let iconHtml;
    if (isLocalUrl(url)) {
        iconHtml = '🔗'; // 本地URL使用默认图标
    } else {
        iconHtml = buildBookmarkFaviconImg(url, '🔗');
    }


    const bookmarks = await dataManager.getBookmarks();

    if (currentModalState.type === 'add_bookmark') {
        const categoryName = bookmarks[currentModalState.catIndex].category;
        const insertIndex = bookmarks[currentModalState.catIndex].items.length;

        bookmarks[currentModalState.catIndex].items.push({
            name,
            url,
            icon: iconHtml
        });
        await dataManager.saveBookmarks(bookmarks);

        // 同步添加书签到浏览器
        await syncBookmarkAddToBrowser(url, name, categoryName, insertIndex);
    } else if (currentModalState.type === 'edit_bookmark') {
        const item = bookmarks[currentModalState.catIndex].items[currentModalState.itemIndex];
        const oldUrl = item.url;
        const oldName = item.name;

        item.name = name;
        item.url = url;
        item.icon = iconHtml; // Update icon as well

        await dataManager.saveBookmarks(bookmarks);

        // 如果URL或名称改变了，同步到浏览器
        if (oldUrl !== url || oldName !== name) {
            await syncBookmarkUpdateToBrowser(oldUrl, url, name);
        }
    }

    closeBookmarkModal();
    loadBookmarks();
}

window.editBookmark = async function (catIndex, itemIndex) {
    const bookmarks = await dataManager.getBookmarks();
    const item = bookmarks[catIndex].items[itemIndex];

    currentModalState.type = 'edit_bookmark';
    currentModalState.catIndex = catIndex;
    currentModalState.itemIndex = itemIndex;

    const modal = document.getElementById('bookmark-modal');
    if (modal) {
        document.querySelector('#bookmark-modal h3').innerText = '编辑书签';
        document.getElementById('bookmark-name').value = item.name;
        document.getElementById('bookmark-url').value = item.url;
        modal.style.display = 'flex';

        // 显示删除按钮（编辑模式）并绑定事件
        // 注意：我们需要在 HTML 中添加这个按钮，或者动态添加
        let delBtn = document.getElementById('modal-delete-btn');
        if (!delBtn) {
            // 如果只有确认和取消按钮，插入一个删除按钮
            const btnContainer = modal.querySelector('.modal-actions') || modal.querySelector('div[style*="justify-content: flex-end"]');
            // 如果没有明显的 container，查找 append 位置
            const container = modal.querySelector('div[style*="justify-content: flex-end"]') || modal.querySelector('div[style*="margin-top"]');

            if (container) {
                delBtn = document.createElement('button');
                delBtn.id = 'modal-delete-btn';
                delBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; margin-right: auto; cursor: pointer;';
                delBtn.innerText = '删除';
                container.insertBefore(delBtn, container.firstChild);
            }
        }
        if (delBtn) {
            delBtn.style.display = 'block';
            // 重新绑定事件以防闭包引用旧变量
            delBtn.onclick = async () => {
                if (await showCustomConfirm('确定删除此书签吗？')) {
                    deleteBookmark(catIndex, itemIndex);
                    closeBookmarkModal();
                }
            };
        }
    }
}

// 右键编辑书签
window.handleBookmarkRightClick = async function (event, catIndex, itemIndex) {
    if (!(await dataManager.isLoggedIn())) return;

    event.preventDefault();
    // 右键点击时打开编辑对话框
    await editBookmark(catIndex, itemIndex);
    return false;
}

// 书签点击处理（统一函数）
window.handleBookmarkClick = async function (event, catIndex, itemIndex) {
    const isSettingsMode = document.getElementById('admin-sidebar')?.classList.contains('open');
    const isAdmin = await dataManager.isLoggedIn();

    // 在设置模式下，如果点击的是书签卡片本身（不是书签项），高亮对应的布局设置项
    if (isSettingsMode && isAdmin) {
        const bookmarkCard = event.target.closest('.bookmark-card');
        if (bookmarkCard) {
            // 找到对应的卡片索引
            const cardIndex = typeof window.getCardControlIndex === 'function'
                ? window.getCardControlIndex(bookmarkCard)
                : Array.from(document.querySelectorAll('#monitor-section .glass-card, #bookmarks-container .glass-card')).indexOf(bookmarkCard);
            if (cardIndex >= 0) {
                event.preventDefault();
                event.stopPropagation();
                // 高亮对应的布局设置项，滚动右侧设置面板使其居中，但不滚动左侧卡片
                if (window.highlightCardControl && typeof window.highlightCardControl === 'function') {
                    window.highlightCardControl(cardIndex, true, false);
                }
                return false;
            }
        }

        // 在设置模式下，点击书签项时防止链接跳转，改为打开编辑
    }

    // 记录点击统计和自动获取logo（异步，不阻塞跳转）
    try {
        const bookmarks = await dataManager.getBookmarks();
        if (bookmarks && bookmarks[catIndex] && bookmarks[catIndex].items[itemIndex]) {
            const bookmark = bookmarks[catIndex].items[itemIndex];

            // 记录点击统计
            dataManager.recordBookmarkClick(bookmark.url, bookmark.name, bookmark.icon).catch(() => { });

            // 自动获取并更新logo（如果还没有logo）
            if (!bookmark.logo) {
                updateBookmarkLogo(bookmark.url, bookmark.name, catIndex, itemIndex).catch(() => { });
            }

            // 更新常用标签栏（延迟更新，不阻塞页面）
            setTimeout(() => {
                loadFrequentBookmarks();
            }, 500);
        }
    } catch (error) {
        console.error('Record bookmark click error:', error);
    }

    // 如果没有拖拽且不是设置模式，允许跳转
    return true;
};

// 删除单个书签
window.deleteBookmark = async function (catIndex, itemIndex) {
    // Internal call mostly used by other functions which already confirmed
    // But if called directly, we might double confirm? 
    // Usually deleteBookmark is called AFTER confirm.
    // Let's keep it direct.

    // if (!await showCustomConfirm("确定删除这个书签吗?")) return; 
    // NO, callers like handleBookmarkRightClick already confirm.
    // We should remove confirm check from here if it was there or ensure callers handle it.

    // The previous code had confirm inside deleteBookmark? No, it was added in callers in previous steps.
    // Checking previous steps: window.deleteBookmark = async function... if(!confirm...
    // Wait, let's check current file. 

    // Checking current file content via memory:
    // Line 553: if (!confirm("确定删除这个书签吗?")) return;

    // So we need to remove it or replace it if it is called directly without check.
    // EditModal calls it after confirm. RightClick calls it after confirm.
    // So we can remove the check inside.

    const bookmarks = await dataManager.getBookmarks();

    // 获取要删除的书签信息（用于同步到浏览器）
    const bookmarkToDelete = bookmarks[catIndex].items[itemIndex];
    const bookmarkUrl = bookmarkToDelete?.url;

    // 从网站删除书签
    bookmarks[catIndex].items.splice(itemIndex, 1);
    await dataManager.saveBookmarks(bookmarks);
    loadBookmarks();

    // 同步删除浏览器书签
    if (bookmarkUrl) {
        syncDeleteToBrowser(bookmarkUrl).catch(error => {
            console.error('[书签删除] 同步删除浏览器书签失败:', error);
            // 不显示错误提示，避免影响用户体验
        });
    }
};

// 同步删除到浏览器（通过扩展）
async function syncDeleteToBrowser(url) {
    try {
        // 方法1: 尝试使用content script注入的全局函数
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.deleteBookmark === 'function') {
            console.log('[书签删除] 通过扩展API删除浏览器书签:', url);
            markLocalRealtimeBrowserSyncWindow();
            await window.godsBookmarkExtension.deleteBookmark(url);
            return;
        }

        // 方法2: 使用 window.postMessage 发送消息给content script
        console.log('[书签删除] 通过postMessage删除浏览器书签:', url);
        window.postMessage({
            type: 'DELETE_BOOKMARK',
            url: url
        }, '*');

    } catch (error) {
        // 扩展可能未安装，这是正常的
        console.log('[书签删除] 无法同步到浏览器（扩展可能未安装）:', error.message);
    }
}

// 同步书签移动/位置变更到浏览器（通过扩展）
async function syncBookmarkMoveToBrowser(url, targetCategory, index) {
    try {
        console.log('[书签同步] 同步书签位置到浏览器:', { url, targetCategory, index });

        // 方法1: 尝试使用content script注入的全局函数
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.moveBookmark === 'function') {
            console.log('[书签同步] 通过扩展API移动浏览器书签:', url);
            markLocalRealtimeBrowserSyncWindow();
            await window.godsBookmarkExtension.moveBookmark(url, targetCategory, index);
            return;
        }

        // 方法2: 使用 window.postMessage 发送消息给content script
        console.log('[书签同步] 通过postMessage移动浏览器书签:', url);
        window.postMessage({
            type: 'MOVE_BOOKMARK',
            url: url,
            targetCategory: targetCategory,
            index: index
        }, '*');

    } catch (error) {
        // 扩展可能未安装，这是正常的
        console.log('[书签同步] 无法同步到浏览器（扩展可能未安装）:', error.message);
    }
}

// 同步书签更新（URL或名称）到浏览器
async function syncBookmarkUpdateToBrowser(oldUrl, newUrl, newName) {
    try {
        console.log('[书签同步] 同步书签更新到浏览器:', { oldUrl, newUrl, newName });

        // 方法1: 尝试使用content script注入的全局函数
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.updateBookmark === 'function') {
            console.log('[书签同步] 通过扩展API更新浏览器书签:', oldUrl);
            markLocalRealtimeBrowserSyncWindow();
            await window.godsBookmarkExtension.updateBookmark(oldUrl, newUrl, newName);
            return;
        }

        // 方法2: 使用 window.postMessage 发送消息给content script
        console.log('[书签同步] 通过postMessage更新浏览器书签:', oldUrl);
        window.postMessage({
            type: 'UPDATE_BOOKMARK',
            oldUrl: oldUrl,
            newUrl: newUrl,
            newName: newName
        }, '*');

    } catch (error) {
        // 扩展可能未安装，这是正常的
        console.log('[书签同步] 无法同步到浏览器（扩展可能未安装）:', error.message);
    }
}

// 同步添加书签到浏览器（通过扩展）
async function syncBookmarkAddToBrowser(url, name, category, index) {
    try {
        console.log('[书签同步] 同步添加书签到浏览器:', { url, name, category, index });

        // 方法1: 尝试使用content script注入的全局函数
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.addBookmark === 'function') {
            console.log('[书签同步] 通过扩展API添加浏览器书签:', url);
            markLocalRealtimeBrowserSyncWindow();
            await window.godsBookmarkExtension.addBookmark(url, name, category, index);
            return;
        }

        // 方法2: 使用 window.postMessage 发送消息给content script
        console.log('[书签同步] 通过postMessage添加浏览器书签:', url);
        window.postMessage({
            type: 'ADD_BOOKMARK',
            url: url,
            name: name,
            category: category,
            index: index
        }, '*');

    } catch (error) {
        // 扩展可能未安装，这是正常的
        console.log('[书签同步] 无法同步到浏览器（扩展可能未安装）:', error.message);
    }
}

// 同步删除文件夹到浏览器（通过扩展）
async function syncDeleteFolderToBrowser(folderName) {
    try {
        console.log('[书签同步] 同步删除文件夹到浏览器:', folderName);

        // 方法1: 尝试使用content script注入的全局函数
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.deleteFolder === 'function') {
            console.log('[书签同步] 通过扩展API删除浏览器文件夹:', folderName);
            markLocalRealtimeBrowserSyncWindow();
            await window.godsBookmarkExtension.deleteFolder(folderName);
            return;
        }

        // 方法2: 使用 window.postMessage 发送消息给content script
        console.log('[书签同步] 通过postMessage删除浏览器文件夹:', folderName);
        window.postMessage({
            type: 'DELETE_FOLDER',
            folderName: folderName
        }, '*');

    } catch (error) {
        // 扩展可能未安装，这是正常的
        console.log('[书签同步] 无法同步到浏览器（扩展可能未安装）:', error.message);
    }
}

// 同步添加文件夹到浏览器（通过扩展）
async function syncAddFolderToBrowser(folderName) {
    try {
        console.log('[书签同步] 同步添加文件夹到浏览器:', folderName);

        // 方法1: 尝试使用content script注入的全局函数
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.addFolder === 'function') {
            console.log('[书签同步] 通过扩展API添加浏览器文件夹:', folderName);
            markLocalRealtimeBrowserSyncWindow();
            await window.godsBookmarkExtension.addFolder(folderName);
            return;
        }

        // 方法2: 使用 window.postMessage 发送消息给content script
        console.log('[书签同步] 通过postMessage添加浏览器文件夹:', folderName);
        window.postMessage({
            type: 'ADD_FOLDER',
            folderName: folderName
        }, '*');

    } catch (error) {
        // 扩展可能未安装，这是正常的
        console.log('[书签同步] 无法同步到浏览器（扩展可能未安装）:', error.message);
    }
}

// 恢复书签卡片样式（在重新渲染后调用）
async function restoreBookmarkStyles() {
    const config = await dataManager.getDashboardConfig();

    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    // 强制刷新一次卡片列表
    const cards = [...container.querySelectorAll('.bookmark-card')];

    // 创建一个映射来存储卡片
    const cardMap = new Map();
    cards.forEach(card => {
        const catName = card.dataset.category || '';
        if (catName.trim()) {
            cardMap.set(catName.trim(), card);
        }
    });

    // 首先重置所有卡片的大小，后续根据配置恢复自定义尺寸
    cards.forEach(card => {
        card.style.width = '';
        card.style.height = '';
        card.style.order = '';
        card.style.gridRow = '';
        card.style.gridColumn = '';
    });

    const applyDefaultBookmarkCardWidths = () => {
        cards.forEach(card => {
            if (card.classList.contains('bookmark-card-collapsed')) {
                return;
            }

            applyBookmarkCardWidthPreset(card, DEFAULT_BOOKMARK_CARD_WIDTH_PRESET);
        });
    };

    if (!config || !Array.isArray(config.bookmarkLayout) || config.bookmarkLayout.length === 0) {
        applyDefaultBookmarkCardWidths();
        syncBookmarkCardWidthsToContainer();
        setTimeout(() => {
            updateBookmarkScrollbars();
        }, 150);
        return;
    }

    applyDefaultBookmarkCardWidths();

    // 第一步：根据配置恢复所有卡片的样式和尺寸
    const sortedCards = [];

    config.bookmarkLayout.forEach(item => {
        const categoryName = item.category.trim();
        const card = cardMap.get(categoryName);

        console.log('[恢复样式] 处理配置项:', categoryName, 'width:', item.width, 'height:', item.height, 'card存在:', !!card);

        if (card) {
            // 恢复尺寸类
            card.className = 'glass-card bookmark-card'; // 重置类
            if (item.span >= 2 && item.span <= 4) {
                card.classList.add(`span-${item.span}`);
            }

            // 恢复隐藏状态
            if (item.hidden === true) {
                card.style.display = 'none';
            } else {
                card.style.display = '';
            }

            // 恢复折叠状态
            if (item.collapsed === true) {
                card.classList.add('bookmark-card-collapsed');
                const grid = card.querySelector('.bookmark-grid');
                if (grid) {
                    grid.classList.add('bookmark-grid-collapsed');
                    grid.style.display = 'none';
                }

                // 如果卡片是折叠状态，保存原始宽高（如果配置中有），然后设置折叠尺寸
                if (item.width !== undefined && item.width !== null) {
                    const w = typeof item.width === 'number' ? item.width + 'px' : String(item.width);
                    card.dataset.originalWidth = w;
                }
                if (item.height !== undefined && item.height !== null) {
                    const h = typeof item.height === 'number' ? item.height + 'px' : String(item.height);
                    card.dataset.originalHeight = h;
                }

                // 设置折叠后的固定尺寸
                card.dataset.originalWidthPreset = item.widthPreset
                    ? normalizeBookmarkCardWidthPreset(item.widthPreset)
                    : getBookmarkCardPresetFromStoredWidth(item.width, getBookmarkCardResizeMetrics(card));
                applyBookmarkCardWidthPreset(card, 'collapsed');
                card.style.width = '100px';
                card.style.height = '70px';
            } else {
                // 恢复自定义宽高（如果配置中存在，且不是折叠状态）
                // 确保正确处理数字格式和字符串格式
                if (item.width !== undefined && item.width !== null && item.width !== '') {
                    let w = '';
                    if (typeof item.width === 'number') {
                        w = item.width + 'px';
                    } else {
                        // 如果是字符串，检查是否包含数字
                        const widthStr = String(item.width);
                        const widthMatch = widthStr.match(/(\d+)/);
                        if (widthMatch) {
                            w = widthMatch[1] + 'px';
                        } else {
                            w = widthStr;
                        }
                    }
                    if (w) {
                        const clampedWidth = clampBookmarkCardWidthValue(w);
                        const finalWidth = clampedWidth !== null ? `${clampedWidth}px` : w;
                        card.style.setProperty('width', finalWidth, 'important');
                        console.log('[恢复样式] 已设置宽度:', categoryName, w);
                    }
                }
                if (item.height !== undefined && item.height !== null && item.height !== '') {
                    let h = '';
                    if (typeof item.height === 'number') {
                        h = item.height + 'px';
                    } else {
                        // 如果是字符串，检查是否包含数字
                        const heightStr = String(item.height);
                        const heightMatch = heightStr.match(/(\d+)/);
                        if (heightMatch) {
                            h = heightMatch[1] + 'px';
                        } else {
                            h = heightStr;
                        }
                    }
                    if (h) {
                        card.style.setProperty('height', h, 'important');
                        console.log('[恢复样式] 已设置高度:', categoryName, h);
                    }
                }
            }

            // 恢复颜色和透明度
            const color = item.color || card.dataset.customColor || '#8b5cf6';
            const opacity = item.opacity || card.dataset.customOpacity || '0.7';

            card.dataset.customColor = color;
            card.dataset.customOpacity = opacity;

            // 调用 dashboard-layout.js 中的全局函数
            // 使用 setTimeout 确保主题已经正确设置到 DOM
            setTimeout(() => {
                if (window.applyCardGradient) {
                    window.applyCardGradient(card, color, opacity);
                }
            }, 0);

            // 保存到排序数组
            sortedCards.push({ card, index: item.index !== undefined ? item.index : 999 });
        }
    });

    // 第二步：按保存的 index 重新排序
    sortedCards.sort((a, b) => a.index - b.index);
    sortedCards.forEach(({ card }) => {
        container.appendChild(card);
    });

    // 卡片重新排序后，更新右侧导航栏（按照实际显示顺序）
    if (typeof window.renderRightNav === 'function') {
        setTimeout(() => {
            window.renderRightNav();
        }, 100);
    }

    // 上帝的指引标题颜色固定为紫色渐变，不再跟随卡片主题色
    // updateFrequentHeaderColor(); // 已禁用

    // 恢复样式后更新滚动条状态
    setTimeout(() => {
        syncBookmarkCardWidthsToContainer();
        updateBookmarkScrollbars();
    }, 150);
}

// 书签导入功能（完整版 - 按原始分类导入并合并到现有分类）
window.handleBookmarkImport = async function (input) {
    const file = input.files[0];
    if (!file) return;

    try {
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const htmlContent = e.target.result;

                // 检查是否是有效的 HTML 书签文件
                if (!htmlContent.includes('<DT>') && !htmlContent.includes('<H3>') && !htmlContent.includes('<DL>')) {
                    alert('无法识别的书签文件格式。请使用浏览器导出的 HTML 格式书签文件。');
                    input.value = '';
                    return;
                }

                // 使用正则表达式解析，因为浏览器导出的HTML可能不标准
                const bookmarkData = parseBookmarkHTML(htmlContent);

                if (bookmarkData.length === 0) {
                    alert('未找到有效的书签数据。请确保书签文件格式正确。');
                    input.value = '';
                    return;
                }

                // 检查是否登录（保存书签需要登录）
                let isLoggedIn = false;
                try {
                    isLoggedIn = await dataManager.isLoggedIn();
                    console.log('[导入] 登录状态检查:', isLoggedIn);
                } catch (error) {
                    console.error('[导入] 检查登录状态失败:', error);
                    alert('❌ 无法检查登录状态。请确保服务器正在运行。\n错误: ' + error.message);
                    input.value = '';
                    return;
                }

                if (!isLoggedIn) {
                    alert('❌ 需要登录才能导入书签。\n请先登录管理员账户（密码: admin）');
                    input.value = '';
                    return;
                }

                console.log('[导入] 已登录，继续导入流程');

                // 获取当前书签数据（保持布局状态）
                let currentData = [];
                try {
                    currentData = await dataManager.getBookmarks();
                } catch (error) {
                    console.error('获取书签数据失败:', error);
                    currentData = [];
                }

                // 合并到现有分类，而不是替换
                const merged = mergeBookmarks(currentData, bookmarkData);

                // 保存书签
                try {
                    const totalBookmarks = merged.reduce((sum, cat) => sum + cat.items.length, 0);
                    console.log('[导入] 准备保存书签，数据量:', merged.length, '个分类，共', totalBookmarks, '个书签');
                    console.log('[导入] 数据大小估算:', JSON.stringify(merged).length, '字符');

                    markLocalRealtimeBrowserSyncWindow();
                    await dataManager.saveBookmarks(merged);
                    updateBookmarksMemoryCache(merged);
                    await syncBrowserBookmarksFromServer();
                    console.log('[导入] 书签保存成功');
                } catch (error) {
                    console.error('保存书签失败:', error);
                    console.error('错误详情:', error.message, error.name);

                    // 提供详细的诊断信息
                    let errorMsg = '❌ 保存失败: ' + error.message;

                    if (error.message.includes('413') || error.message.includes('Payload Too Large')) {
                        errorMsg = '❌ 数据过大，无法保存\n\n' +
                            '原因：导入的书签数据量太大（超过服务器限制）\n\n' +
                            '解决方法：\n' +
                            '1. 分批导入：将书签文件分成多个小文件分别导入\n' +
                            '2. 服务器已自动调整限制，请刷新页面后重试\n' +
                            '3. 如果问题仍然存在，请联系管理员';
                    } else if (error.message.includes('无法连接到服务器') ||
                        error.message.includes('Failed to fetch') ||
                        error.message.includes('Network')) {
                        errorMsg = '❌ 无法连接到服务器\n\n' +
                            '请检查：\n' +
                            '1. 服务器是否正在运行（运行 node server.js）\n' +
                            '2. 服务器地址是否正确（http://localhost:3000）\n' +
                            '3. 打开浏览器控制台（F12）查看详细错误信息\n' +
                            '4. 确保您已登录管理员账户';
                    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                        errorMsg = '❌ 未登录或会话已过期\n请先登录管理员账户后再导入书签。';
                    }

                    alert(errorMsg);
                    input.value = '';
                    return;
                }

                // 重新加载书签，但保持当前布局状态
                await loadBookmarks();

                // 延迟恢复布局状态，确保DOM已更新
                setTimeout(() => {
                    restoreBookmarkStyles();
                    // 重新初始化布局编辑（如果需要）
                    if (window.enableLayoutEditing && document.body.classList.contains('layout-editing')) {
                        window.enableLayoutEditing();
                    }
                }, 200);

                const totalItems = bookmarkData.reduce((sum, cat) => sum + cat.items.length, 0);
                alert(`✅ 成功导入 ${bookmarkData.length} 个分类，共 ${totalItems} 个书签！\n书签已合并到现有分类中。`);

                input.value = '';
            } catch (error) {
                console.error('导入错误:', error);
                // 提供更详细的错误信息
                let errorMsg = '导入失败: ' + error.message;
                if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
                    errorMsg = '❌ 导入失败：无法连接到服务器。\n请确保服务器正在运行，并且您已登录管理员账户。';
                }
                alert(errorMsg);
                input.value = '';
            }
        };

        reader.onerror = function () {
            alert('文件读取失败，请重试。');
            input.value = '';
        };

        reader.readAsText(file);
    } catch (error) {
        console.error('导入处理错误:', error);
        alert('导入失败: ' + error.message);
        input.value = '';
    }
};

// 解析书签HTML文件（完整保留原始分类路径）
function parseBookmarkHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rootDl = doc.querySelector('dl');

    if (!rootDl) {
        return parseBookmarkHTMLRegex(html);
    }

    const parsedCategories = parseBookmarkDlTree(rootDl, []);
    return parsedCategories.length > 0 ? parsedCategories : parseBookmarkHTMLRegex(html);
}

function normalizeImportedCategoryName(pathSegments) {
    const cleaned = (Array.isArray(pathSegments) ? pathSegments : [])
        .map(segment => String(segment || '').trim())
        .filter(Boolean);

    return cleaned.length > 0 ? cleaned.join(' / ') : '导入书签';
}

function createImportedBookmarkItem(name, url, categoryPath) {
    const normalizedName = String(name || '').trim();
    const normalizedUrl = String(url || '').trim();
    const normalizedCategoryPath = normalizeImportedCategoryName(categoryPath);

    if (!normalizedName || !normalizedUrl) {
        return null;
    }

    let icon = '🔗';
    try {
        if (!isLocalUrl(normalizedUrl)) {
            icon = buildBookmarkFaviconImg(normalizedUrl, '🔗');
        }
    } catch (error) {
        icon = '🔗';
    }

    return {
        name: normalizedName,
        url: normalizedUrl,
        icon,
        folderPath: normalizedCategoryPath
    };
}

function mergeImportedCategoryEntries(entries) {
    const categoryMap = new Map();

    (Array.isArray(entries) ? entries : []).forEach(entry => {
        const categoryName = normalizeImportedCategoryName([entry?.category]);
        if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, {
                category: categoryName,
                items: []
            });
        }

        const category = categoryMap.get(categoryName);
        const existingUrls = new Set(category.items.map(item => item.url));

        (Array.isArray(entry?.items) ? entry.items : []).forEach(item => {
            if (!item?.url || existingUrls.has(item.url)) {
                return;
            }
            category.items.push({ ...item, folderPath: item.folderPath || categoryName });
            existingUrls.add(item.url);
        });
    });

    return Array.from(categoryMap.values()).filter(category => category.items.length > 0);
}

function parseBookmarkDlTree(dl, parentPath = []) {
    if (!dl) {
        return [];
    }

    const categories = [];
    const currentFolderItems = [];
    const children = Array.from(dl.children);

    for (let index = 0; index < children.length; index += 1) {
        const node = children[index];
        if (!node || node.tagName !== 'DT') {
            continue;
        }

        const directFolder = Array.from(node.children).find(child => child.tagName === 'H3');
        const directLink = Array.from(node.children).find(child => child.tagName === 'A');
        const nestedDl = Array.from(node.children).find(child => child.tagName === 'DL')
            || (children[index + 1]?.tagName === 'DL' ? children[index + 1] : null);

        if (directFolder) {
            const folderName = directFolder.textContent.trim();
            const folderPath = folderName ? [...parentPath, folderName] : parentPath;
            const childCategories = parseBookmarkDlTree(nestedDl, folderPath);
            categories.push(...childCategories);
            continue;
        }

        if (directLink) {
            const item = createImportedBookmarkItem(
                directLink.textContent.trim(),
                directLink.getAttribute('href') || directLink.href,
                parentPath
            );
            if (item) {
                currentFolderItems.push(item);
            }
        }
    }

    if (currentFolderItems.length > 0) {
        categories.unshift({
            category: normalizeImportedCategoryName(parentPath),
            items: currentFolderItems
        });
    }

    return mergeImportedCategoryEntries(categories);
}

// 备用：非标准HTML时也尽量按层级解析
function parseBookmarkHTMLRegex(html) {
    const lines = String(html || '')
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const folderStack = [];
    const categories = [];

    lines.forEach(line => {
        const folderMatch = line.match(/<H3[^>]*>(.*?)<\/H3>/i);
        if (folderMatch) {
            const folderName = folderMatch[1].replace(/<[^>]+>/g, '').trim();
            if (folderName) {
                folderStack.push(folderName);
            }
            return;
        }

        if (/<\/DL>/i.test(line) || /<\/DL><p>/i.test(line)) {
            if (folderStack.length > 0) {
                folderStack.pop();
            }
            return;
        }

        const bookmarkMatch = line.match(/<A[^>]+HREF\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/A>/i);
        if (!bookmarkMatch) {
            return;
        }

        const url = bookmarkMatch[1].trim();
        const name = bookmarkMatch[2].replace(/<[^>]+>/g, '').trim();
        const item = createImportedBookmarkItem(name, url, folderStack);
        if (!item) {
            return;
        }

        categories.push({
            category: normalizeImportedCategoryName(folderStack),
            items: [item]
        });
    });

    return mergeImportedCategoryEntries(categories);
}

// 合并书签到现有分类
function mergeBookmarks(currentData, newData) {
    const result = [...currentData];

    newData.forEach(newCategory => {
        // 查找是否已存在同名分类
        const existingIndex = result.findIndex(cat => cat.category === newCategory.category);

        if (existingIndex >= 0) {
            // 合并到现有分类
            const existingItems = result[existingIndex].items;
            const existingUrls = new Set(existingItems.map(item => item.url));

            // 只添加不重复的书签
            newCategory.items.forEach(item => {
                if (!existingUrls.has(item.url)) {
                    existingItems.push(item);
                }
            });
        } else {
            // 添加新分类
            result.push(newCategory);
        }
    });

    return result;
}

restoreBookmarkStyles = async function () {
    const config = await dataManager.getDashboardConfig();
    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    const cards = [...container.querySelectorAll('.bookmark-card')];
    const cardMap = new Map();

    cards.forEach(card => {
        const category = (card.dataset.category || '').trim();
        if (category) {
            cardMap.set(category, card);
        }

        card.style.width = '';
        card.style.height = '';
        card.style.order = '';
        card.style.gridRow = '';
        card.style.gridColumn = '';
        delete card.dataset.originalWidthPreset;
    });

    const applyDefaultBookmarkCardWidths = () => {
        cards.forEach(card => {
            if (!card.classList.contains('bookmark-card-collapsed')) {
                applyBookmarkCardWidthPreset(card, DEFAULT_BOOKMARK_CARD_WIDTH_PRESET);
            }
        });
    };

    if (!config || !Array.isArray(config.bookmarkLayout) || config.bookmarkLayout.length === 0) {
        applyDefaultBookmarkCardWidths();
        syncBookmarkCardWidthsToContainer();
        setTimeout(() => {
            updateBookmarkScrollbars();
        }, 150);
        return;
    }

    applyDefaultBookmarkCardWidths();

    const sortedCards = [];

    config.bookmarkLayout.forEach(item => {
        const categoryName = (item.category || '').trim();
        const card = cardMap.get(categoryName);
        if (!card) {
            return;
        }

        card.className = 'glass-card bookmark-card';
        if (item.span >= 2 && item.span <= 4) {
            card.classList.add(`span-${item.span}`);
        }

        card.style.display = item.hidden === true ? 'none' : '';

        const grid = card.querySelector('.bookmark-grid');
        const widthPreset = item.widthPreset
            ? normalizeBookmarkCardWidthPreset(item.widthPreset)
            : getBookmarkCardPresetFromStoredWidth(item.width, getBookmarkCardResizeMetrics(card));

        if (item.collapsed === true) {
            card.classList.add('bookmark-card-collapsed');
            if (grid) {
                grid.classList.add('bookmark-grid-collapsed');
                grid.style.display = 'none';
            }

            card.dataset.originalWidthPreset = widthPreset;
            applyBookmarkCardWidthPreset(card, 'collapsed');
            card.style.width = '100px';
            card.style.height = '70px';
        } else {
            if (grid) {
                grid.classList.remove('bookmark-grid-collapsed');
                grid.style.display = 'grid';
            }

            applyBookmarkCardWidthPreset(card, widthPreset);

            if (item.height !== undefined && item.height !== null && item.height !== '') {
                let h = '';
                if (typeof item.height === 'number') {
                    h = item.height + 'px';
                } else {
                    const heightStr = String(item.height);
                    const heightMatch = heightStr.match(/(\d+)/);
                    h = heightMatch ? `${heightMatch[1]}px` : heightStr;
                }

                if (h) {
                    card.style.setProperty('height', h, 'important');
                }
            }
        }

        const color = item.color || card.dataset.customColor || '#8b5cf6';
        const opacity = item.opacity || card.dataset.customOpacity || '0.7';
        card.dataset.customColor = color;
        card.dataset.customOpacity = opacity;

        setTimeout(() => {
            if (window.applyCardGradient) {
                window.applyCardGradient(card, color, opacity);
            }
        }, 0);

        sortedCards.push({ card, index: item.index !== undefined ? item.index : 999 });
    });

    sortedCards.sort((a, b) => a.index - b.index);
    sortedCards.forEach(({ card }) => {
        container.appendChild(card);
    });

    if (typeof window.renderRightNav === 'function') {
        setTimeout(() => {
            window.renderRightNav();
        }, 100);
    }

    setTimeout(() => {
        syncBookmarkCardWidthsToContainer();
        updateBookmarkScrollbars();
    }, 150);
};

window.restoreBookmarkStyles = restoreBookmarkStyles;

// Final free-layout overrides: keep resize handles available for all bookmark cards
// while the settings sidebar is open, regardless of highlight state.
(function applyFinalBookmarkFreeLayoutOverrides() {
    function clearBookmarkCardResizeHandlesFinal() {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((bookmarkCard) => {
            bookmarkCard.classList.remove(
                'resizable',
                'resizing',
                'bookmark-card-resizable',
                'bookmark-card-resizing',
                'bookmark-card-resizing-width',
                'bookmark-card-resizing-height'
            );
            bookmarkCard.querySelectorAll(
                '.bookmark-resize-handle-right-edge, .bookmark-resize-handle-left-edge, .bookmark-resize-handle-top-edge, .bookmark-resize-handle-bottom-edge, .bookmark-resize-handle-right, .bookmark-resize-handle-bottom, .resize-handle, .resize-handle-edge, .resize-handle-top, .resize-handle-bottom, .resize-handle-left, .resize-handle-right, .resize-handle-corner, .resize-handle-top-left, .resize-handle-top-right, .resize-handle-bottom-left, .resize-handle-bottom-right'
            ).forEach((handle) => handle.remove());
        });
        document.body.classList.remove('bookmark-card-resizing-active');
    }

    function refreshBookmarkCardResizeHandlesFinal() {
        clearBookmarkCardResizeHandlesFinal();

        if (!document.body.classList.contains('sidebar-open')) {
            return;
        }

        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            ensureBookmarkCardResizeHandles(card);
        });
    }

    window.clearBookmarkCardResizeHandles = function () {
        clearBookmarkCardResizeHandlesFinal();

        if (document.body.classList.contains('sidebar-open')) {
            requestAnimationFrame(() => {
                refreshBookmarkCardResizeHandlesFinal();
            });
        }
    };

    window.addBookmarkCardResizeHandles = function (card) {
        if (!document.body.classList.contains('sidebar-open')) {
            return;
        }

        if (card) {
            ensureBookmarkCardResizeHandles(card);
            return;
        }

        refreshBookmarkCardResizeHandlesFinal();
    };

    window.enableBookmarkCardSort = function () {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            if (card.dataset.bookmarkFreeMoveBound === 'true') return;
            card.dataset.bookmarkFreeMoveBound = 'true';
            card.addEventListener('mousedown', handleBookmarkFreeDragStart);
        });

        refreshBookmarkCardResizeHandlesFinal();
    };

    window.disableBookmarkCardSort = function () {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            card.removeEventListener('mousedown', handleBookmarkFreeDragStart);
            delete card.dataset.bookmarkFreeMoveBound;
            card.classList.remove('bookmark-card-free-dragging', 'bookmark-card-swap-target');
        });

        cleanupBookmarkFreeDragState();
        clearBookmarkCardResizeHandlesFinal();
    };

window.refreshBookmarkCardResizeHandles = refreshBookmarkCardResizeHandlesFinal;
})();

// In normal mode, intercept title clicks so the legacy click-based double-click
// handler does not fire twice; we only toggle on the native dblclick event.
(() => {
    if (window.__bookmarkTitleDblclickGuardBound) {
        return;
    }
    window.__bookmarkTitleDblclickGuardBound = true;

    const getNormalModeTitle = (eventTarget) => {
        const sidebarOpen = document.getElementById('admin-sidebar')?.classList.contains('open');
        if (sidebarOpen) {
            return null;
        }

        return eventTarget?.closest?.('#bookmarks-container .bookmark-card-title') || null;
    };

    document.addEventListener('click', (e) => {
        const title = getNormalModeTitle(e.target);
        if (!title) {
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);

    document.addEventListener('dblclick', (e) => {
        const title = getNormalModeTitle(e.target);
        if (!title) {
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        const categoryName = title.getAttribute('data-category');
        if (categoryName && typeof window.toggleBookmarkCardCollapse === 'function') {
            window.toggleBookmarkCardCollapse(categoryName);
        }
    }, true);
})();

syncBrowserBookmarksFromServer = async function () {
    try {
        if (window.godsBookmarkExtension && typeof window.godsBookmarkExtension.syncServerBookmarks === 'function') {
            if (typeof window.godsBookmarkExtension.isReady === 'function' &&
                !window.godsBookmarkExtension.isReady()) {
                return;
            }
            await window.godsBookmarkExtension.syncServerBookmarks();
            return;
        }

        window.postMessage({
            type: 'SYNC_SERVER_BOOKMARKS'
        }, '*');
    } catch (error) {
        console.error('[书签同步] 触发浏览器全量对账失败:', error);
    }
};

function clearBookmarkCardResizeHandlesInternal() {
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(bookmarkCard => {
        bookmarkCard.classList.remove(
            'bookmark-card-resizable',
            'bookmark-card-resizing',
            'bookmark-card-resizing-width',
            'bookmark-card-resizing-height'
        );
        bookmarkCard.querySelectorAll('.bookmark-resize-handle-right-edge, .bookmark-resize-handle-left-edge, .bookmark-resize-handle-top-edge, .bookmark-resize-handle-bottom-edge').forEach(handle => handle.remove());
    });
    document.body.classList.remove('bookmark-card-resizing-active');
}

function refreshBookmarkCardResizeHandlesStable() {
    clearBookmarkCardResizeHandlesInternal();

    if (!document.body.classList.contains('sidebar-open')) {
        return;
    }

    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        ensureBookmarkCardResizeHandles(card);
    });
}

window.clearBookmarkCardResizeHandles = function () {
    clearBookmarkCardResizeHandlesInternal();
};

window.addBookmarkCardResizeHandles = function (card) {
    if (!document.body.classList.contains('sidebar-open')) {
        return;
    }

    if (card) {
        ensureBookmarkCardResizeHandles(card);
        return;
    }

    refreshBookmarkCardResizeHandlesStable();
};

window.enableBookmarkCardSort = function () {
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        if (card.dataset.bookmarkFreeMoveBound === 'true') return;
        card.dataset.bookmarkFreeMoveBound = 'true';
        card.addEventListener('mousedown', handleBookmarkFreeDragStart);
    });
    refreshBookmarkCardResizeHandlesStable();
};

window.disableBookmarkCardSort = function () {
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        card.removeEventListener('mousedown', handleBookmarkFreeDragStart);
        delete card.dataset.bookmarkFreeMoveBound;
        card.classList.remove('bookmark-card-free-dragging', 'bookmark-card-swap-target');
    });
    cleanupBookmarkFreeDragState();
    clearBookmarkCardResizeHandlesInternal();
};
window.renderTodos = renderTodos;
window.updateTodosConfigCache = updateTodosConfigCache;

// 书签导出功能（导出为HTML格式，包含分类信息）
window.exportBookmarks = async function () {
    try {
        // 检查是否登录
        const isLoggedIn = await dataManager.isLoggedIn();
        if (!isLoggedIn) {
            alert('❌ 需要登录才能导出书签。\n请先登录管理员账户。');
            return;
        }

        // 获取书签数据
        const bookmarks = await dataManager.getBookmarks();

        if (!bookmarks || bookmarks.length === 0) {
            alert('暂无书签可导出。');
            return;
        }

        // 生成HTML格式的书签文件
        let htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

        // 遍历所有分类
        bookmarks.forEach(category => {
            // 添加分类标题
            htmlContent += `    <DT><H3 ADD_DATE="${Date.now()}" LAST_MODIFIED="${Date.now()}">${escapeHtml(category.category)}</H3>\n`;
            htmlContent += `    <DL><p>\n`;

            // 添加该分类下的所有书签
            category.items.forEach(item => {
                const url = item.url || '#';
                const name = item.name || 'Untitled';
                const addDate = Date.now(); // 可以使用item的创建时间如果有的话

                htmlContent += `        <DT><A HREF="${escapeHtml(url)}" ADD_DATE="${addDate}">${escapeHtml(name)}</A></DT>\n`;
            });

            htmlContent += `    </DL><p>\n`;
        });

        htmlContent += `</DL><p>`;

        // 创建Blob对象并下载
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // 生成文件名（带时间戳）
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        link.download = `bookmarks_${timestamp}.html`;

        // 触发下载
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 清理URL对象
        setTimeout(() => URL.revokeObjectURL(url), 100);

        // 显示成功消息
        const totalBookmarks = bookmarks.reduce((sum, cat) => sum + cat.items.length, 0);
        alert(`✅ 成功导出 ${bookmarks.length} 个分类，共 ${totalBookmarks} 个书签！\n文件名: ${link.download}`);

    } catch (error) {
        console.error('导出书签错误:', error);
        alert('❌ 导出失败: ' + error.message);
    }
};

// ===== 全局搜索功能 =====
let allBookmarksCache = []; // 缓存所有书签数据
let clickStatsCache = {}; // 缓存点击统计数据
let currentSearchResults = [];
let selectedResultIndex = -1;

// 功能项列表（用于搜索）
const functionItems = [
    {
        id: 'new-todo',
        name: '新建便签',
        keywords: ['便签', '待办', 'todo', '新建', '添加便签', '创建便签'],
        icon: '📝',
        type: 'function',
        action: () => {
            if (typeof showAddTodoInput === 'function') {
                showAddTodoInput();
            }
        }
    },
    {
        id: 'add-category',
        name: '添加分组',
        keywords: ['分组', '分类', '添加分组', '新建分组', '添加分类', '新建分类', 'category'],
        icon: '➕',
        type: 'function',
        action: () => {
            // 触发控制中心菜单的添加分类事件
            const addCategoryLink = document.querySelector('.control-menu-link[data-action="add-category"]');
            if (addCategoryLink) {
                addCategoryLink.click();
            }
        }
    },
    {
        id: 'import-bookmarks',
        name: '导入书签',
        keywords: ['导入', 'import', '导入书签', '书签导入'],
        icon: '📥',
        type: 'function',
        action: () => {
            const importFile = document.getElementById('import-file');
            if (importFile) {
                importFile.click();
            }
        }
    },
    {
        id: 'export-bookmarks',
        name: '导出书签',
        keywords: ['导出', 'export', '导出书签', '书签导出'],
        icon: '📤',
        type: 'function',
        action: () => {
            // 触发控制中心菜单的导出事件
            const exportLink = document.querySelector('.control-menu-link[data-action="export"]');
            if (exportLink) {
                exportLink.click();
            }
        }
    },
    {
        id: 'global-settings',
        name: '全局设置',
        keywords: ['设置', '全局设置', 'settings', '配置', 'config'],
        icon: '⚙️',
        type: 'function',
        action: () => {
            // 触发控制中心菜单的设置事件
            const settingsLink = document.querySelector('.control-menu-link[data-action="settings"]');
            if (settingsLink) {
                settingsLink.click();
            }
        }
    }
];

// 初始化全局搜索
async function initGlobalSearch() {
    // 加载书签缓存
    await refreshBookmarksCache();

    // 加载搜索配置
    await loadSearchConfig();

    // 监听来自扩展的消息（用于快捷键打开搜索浮窗）
    window.addEventListener('message', (event) => {
        // 验证消息来源（来自扩展的content script）
        if (event.data && event.data.type === 'OPEN_SEARCH_MODAL') {
            if (typeof window.openSearchModal === 'function') {
                window.openSearchModal();
            }
        }
    });

    // 绑定搜索框事件
    const searchInput = document.getElementById('global-search-input');
    const modalInput = document.getElementById('global-search-modal-input');
    const searchModal = document.getElementById('global-search-modal');
    const inlineDropdown = document.getElementById('global-search-dropdown');
    const inlineDropdownResults = document.getElementById('global-search-dropdown-results');

    if (searchInput) {
        // 输入事件：实时根据书签搜索，渲染网页内下拉结果（规则与浮窗搜索相同）
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (!query) {
                hideInlineSearchDropdown();
                return;
            }
            handleSearch(query, false);
        });

        // 键盘事件：与浮窗搜索规则保持一致
        searchInput.addEventListener('keydown', (e) => {
            const query = e.target.value.trim();

            if (e.key === 'Enter') {
                e.preventDefault();
                if (query) {
                    if (selectedResultIndex >= 0 && currentSearchResults[selectedResultIndex]) {
                        // 有选中的书签时，优先打开选中书签
                        openSearchResult(currentSearchResults[selectedResultIndex]);
                    } else {
                        // 没有选中书签时，按规则进行网络搜索
                        const searchEngine = window.searchConfig?.searchEngine || 'https://www.bing.com/search?q=';
                        const searchUrl = searchEngine + encodeURIComponent(query);
                        window.open(searchUrl, '_blank');
                    }
                }
                hideInlineSearchDropdown();
            } else if (e.key === 'ArrowDown') {
                if (inlineDropdown && inlineDropdown.classList.contains('show') && currentSearchResults.length > 0) {
                    e.preventDefault();
                    navigateResults(1, false);
                }
            } else if (e.key === 'ArrowUp') {
                if (inlineDropdown && inlineDropdown.classList.contains('show') && currentSearchResults.length > 0) {
                    e.preventDefault();
                    navigateResults(-1, false);
                }
            } else if (e.key === 'Escape') {
                hideInlineSearchDropdown();
            }
        });

        // 失焦时稍后隐藏（避免点击结果被打断）
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                hideInlineSearchDropdown();
            }, 200);
        });
    }

    if (modalInput) {
        modalInput.addEventListener('input', async (e) => {
            // 确保缓存已加载
            if (!allBookmarksCache || allBookmarksCache.length === 0) {
                console.log('[GlobalSearch] 输入时发现缓存为空，正在刷新...');
                await refreshBookmarksCache();
            }
            await handleSearch(e.target.value, true);
        });
        modalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    if (selectedResultIndex >= 0 && currentSearchResults[selectedResultIndex]) {
                        // 如果选中了书签，打开选中的书签
                        openSearchResult(currentSearchResults[selectedResultIndex]);
                    } else {
                        // 如果没有选中任何书签，直接使用搜索引擎搜索
                        const searchEngine = window.searchConfig?.searchEngine || 'https://www.bing.com/search?q=';
                        const searchUrl = searchEngine + encodeURIComponent(query);
                        window.open(searchUrl, '_blank');
                        closeSearchModal();
                    }
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateResults(1, true);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateResults(-1, true);
            } else if (e.key === 'Escape') {
                closeSearchModal();
            }
        });
    }

    // 点击浮窗外部关闭
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                closeSearchModal();
            }
        });
    }

    // 点击页面其它区域时，关闭网页内下拉结果
    document.addEventListener('click', (e) => {
        const searchWrapper = document.querySelector('.global-search-wrapper');
        if (!searchWrapper || !inlineDropdown) return;
        if (!searchWrapper.contains(e.target) && !inlineDropdown.contains(e.target)) {
            hideInlineSearchDropdown();
        }
    });

    // 绑定快捷键
    document.addEventListener('keydown', handleSearchShortcut);
}

// 显示网页内搜索下拉菜单（复用浮窗搜索的结果渲染规则）
function showInlineSearchDropdown(results) {
    const dropdown = document.getElementById('global-search-dropdown');
    const dropdownResults = document.getElementById('global-search-dropdown-results');
    if (!dropdown || !dropdownResults) return;

    if (!results || results.length === 0) {
        dropdownResults.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'global-search-empty';
        emptyDiv.textContent = '暂无匹配的书签';
        dropdownResults.appendChild(emptyDiv);
    } else {
        renderResultsToContainer(results, dropdownResults, 'global-search-result-item');
    }

    dropdown.classList.add('show');
}

// 隐藏网页内搜索下拉菜单
function hideInlineSearchDropdown() {
    const dropdown = document.getElementById('global-search-dropdown');
    const dropdownResults = document.getElementById('global-search-dropdown-results');
    if (!dropdown || !dropdownResults) return;

    dropdown.classList.remove('show');
    dropdownResults.textContent = '';
}


// 加载搜索配置
async function loadSearchConfig() {
    try {
        const config = await dataManager.getDashboardConfig();
        window.searchConfig = {
            searchEngine: config.searchEngine || 'https://www.bing.com/search?q=',
            shortcut: config.searchShortcut || 'Ctrl+Space'
        };
    } catch (error) {
        console.error('[GlobalSearch] 加载配置失败:', error);
        window.searchConfig = {
            searchEngine: 'https://www.bing.com/search?q=',
            shortcut: 'Ctrl+Space'
        };
    }
}

// 刷新书签缓存
async function refreshBookmarksCache() {
    try {
        console.log('[GlobalSearch] 开始刷新书签缓存...');
        const bookmarksData = await dataManager.getBookmarks();
        allBookmarksCache = [];

        if (!bookmarksData || !Array.isArray(bookmarksData)) {
            console.warn('[GlobalSearch] 书签数据格式不正确:', typeof bookmarksData);
            return;
        }

        bookmarksData.forEach((category, catIndex) => {
            if (category && category.items && Array.isArray(category.items)) {
                category.items.forEach((item, itemIndex) => {
                    if (item && item.name) {
                        allBookmarksCache.push({
                            name: item.name || '',
                            url: item.url || '',
                            icon: item.icon || '🔗',
                            category: category.category || '未分类',
                            catIndex,
                            itemIndex
                        });
                    }
                });
            }
        });

        console.log('[GlobalSearch] 已缓存', allBookmarksCache.length, '个书签');

        // 同时刷新点击统计数据（失败不影响主流程）
        try {
            await refreshClickStatsCache();
        } catch (statsError) {
            console.warn('[GlobalSearch] 刷新点击统计失败，但不影响搜索功能:', statsError);
        }

        const success = allBookmarksCache.length > 0;
        if (!success) {
            console.warn('[GlobalSearch] 缓存刷新完成，但书签数量为0');
        }

        // 同步到Chrome扩展存储（用于跨页面搜索）
        try {
            await syncCacheToExtension();
        } catch (syncError) {
            console.warn('[GlobalSearch] 同步到扩展存储失败，但不影响当前页面搜索:', syncError);
        }

        return success;
    } catch (error) {
        console.error('[GlobalSearch] 刷新书签缓存失败:', error);
        console.error('[GlobalSearch] 错误详情:', error.message);
        if (error.stack) {
            console.error('[GlobalSearch] 错误堆栈:', error.stack);
        }
        // 清空缓存，避免使用旧数据
        allBookmarksCache = [];
        // 不抛出异常，但返回 false 表示失败
        return false;
    }
}

// 将书签缓存同步到Chrome扩展存储（用于跨页面搜索）
async function syncCacheToExtension() {
    try {
        // 准备要同步的数据
        // 注意：functionItems 包含函数，无法通过 postMessage 传递，需要序列化
        const serializedFunctionItems = functionItems.map(item => ({
            id: item.id,
            name: item.name,
            keywords: item.keywords,
            icon: item.icon,
            type: item.type
            // 不包含 action 函数
        }));

        const dataToSync = {
            bookmarksCache: allBookmarksCache,
            functionItems: serializedFunctionItems,
            clickStatsCache: clickStatsCache,
            lastUpdate: Date.now()
        };

        // 通过 postMessage 发送给 content script
        // content script 会监听这个消息并写入 chrome.storage
        window.postMessage({
            type: 'SYNC_BOOKMARK_DATA',
            data: dataToSync
        }, '*');

        console.log('[CacheSync] 已发送同步请求，数据量:', allBookmarksCache.length, '个书签');

    } catch (error) {
        console.error('[CacheSync] 同步到扩展存储失败:', error);
    }
}

// 刷新点击统计数据缓存
async function refreshClickStatsCache() {
    try {
        // 获取点击统计数据
        const topBookmarks = await dataManager.getTopBookmarks(1000); // 获取足够多的数据
        clickStatsCache = {};

        topBookmarks.forEach(bookmark => {
            if (bookmark.url && bookmark.count) {
                clickStatsCache[bookmark.url] = bookmark.count;
            }
        });

        console.log('[GlobalSearch] 已缓存', Object.keys(clickStatsCache).length, '个点击统计');
    } catch (error) {
        console.error('[GlobalSearch] 刷新点击统计缓存失败:', error);
        clickStatsCache = {};
    }
}

// 处理搜索输入
async function handleSearch(query, isModal = false) {
    if (!query || query.trim() === '') {
        if (isModal) {
            renderSearchResults([], isModal);
        } else {
            hideInlineSearchDropdown();
        }
        return;
    }

    // 确保书签缓存已加载（如果缓存为空，先刷新）
    if (!allBookmarksCache || allBookmarksCache.length === 0) {
        console.log('[GlobalSearch] 搜索时发现缓存为空，正在刷新...');
        try {
            const success = await refreshBookmarksCache();
            if (!success) {
                console.warn('[GlobalSearch] 缓存刷新失败，将只搜索功能项');
            }
        } catch (refreshError) {
            console.error('[GlobalSearch] 刷新缓存失败:', refreshError);
            // 继续执行搜索，即使缓存刷新失败
        }
    }

    const trimmedQuery = query.trim().toLowerCase();

    // 搜索功能项（即使缓存失败也能搜索功能）
    let functionResults = [];
    try {
        functionResults = searchFunctions(trimmedQuery);
        console.log('[GlobalSearch] 功能搜索结果:', functionResults.length, '个');
    } catch (funcError) {
        console.error('[GlobalSearch] 搜索功能项失败:', funcError);
    }

    // 搜索书签（如果缓存可用）
    let bookmarkResults = [];
    if (allBookmarksCache && allBookmarksCache.length > 0) {
        try {
            bookmarkResults = searchBookmarks(trimmedQuery);
            console.log('[GlobalSearch] 书签搜索结果:', bookmarkResults.length, '个');
        } catch (bookmarkError) {
            console.error('[GlobalSearch] 搜索书签失败:', bookmarkError);
        }
    } else {
        console.log('[GlobalSearch] 书签缓存为空，跳过书签搜索');
    }

    // 合并结果，功能项优先显示（放在前面）
    const results = [...functionResults, ...bookmarkResults];
    console.log('[GlobalSearch] 总搜索结果:', results.length, '个（功能:', functionResults.length, '书签:', bookmarkResults.length, '）');
    renderSearchResults(results, isModal);
}

// 搜索功能项
function searchFunctions(query) {
    if (!query || query.length === 0) {
        return [];
    }

    // 确保 functionItems 已定义
    if (!functionItems || !Array.isArray(functionItems)) {
        console.warn('[GlobalSearch] 功能项列表未定义');
        return [];
    }

    const results = [];
    const queryLower = query.toLowerCase();

    functionItems.forEach(func => {
        // 确保 func 对象有效
        if (!func || !func.name) {
            return;
        }
        let score = 0;
        const nameLower = func.name.toLowerCase();

        // 名称完全匹配
        if (nameLower === queryLower) {
            score += 100;
        }
        // 名称开头匹配
        else if (nameLower.startsWith(queryLower)) {
            score += 80;
        }
        // 名称包含
        else if (nameLower.includes(queryLower)) {
            score += 60;
        }

        // 关键词匹配
        func.keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            if (keywordLower === queryLower) {
                score += 70;
            } else if (keywordLower.includes(queryLower)) {
                score += 40;
            } else if (queryLower.includes(keywordLower)) {
                score += 30;
            }
        });

        // 如果匹配，添加到结果
        if (score > 0) {
            results.push({
                id: func.id,
                name: func.name,
                icon: func.icon,
                type: 'function',
                score: score,
                action: func.action
            });
        }
    });

    // 按分数排序，取前3个
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 3);
}

// 搜索书签
function searchBookmarks(query) {
    if (!query || query.length === 0) {
        return [];
    }

    // 如果缓存为空，返回空结果
    if (!allBookmarksCache || !Array.isArray(allBookmarksCache) || allBookmarksCache.length === 0) {
        console.warn('[GlobalSearch] 书签缓存为空，无法搜索书签');
        return [];
    }

    const results = [];
    const queryLower = query.toLowerCase();

    // 计算相关度分数
    allBookmarksCache.forEach(bookmark => {
        // 确保 bookmark 对象有效
        if (!bookmark || !bookmark.name) {
            return;
        }
        const nameLower = bookmark.name.toLowerCase();
        const urlLower = bookmark.url.toLowerCase();
        const categoryLower = bookmark.category.toLowerCase();

        let score = 0;

        // 名称完全匹配
        if (nameLower === queryLower) {
            score += 100;
        }
        // 名称开头匹配
        else if (nameLower.startsWith(queryLower)) {
            score += 50;
        }
        // 名称包含
        else if (nameLower.includes(queryLower)) {
            score += 30;
        }

        // URL包含
        if (urlLower.includes(queryLower)) {
            score += 20;
        }

        // 分类匹配
        if (categoryLower.includes(queryLower)) {
            score += 10;
        }

        // 如果匹配，添加到结果
        if (score > 0) {
            // 获取点击频率权重（高频置顶）
            const clickCount = clickStatsCache[bookmark.url] || 0;
            // 点击次数转换为权重分数（每10次点击增加1分，最高加50分）
            const frequencyScore = Math.min(clickCount / 10, 50);

            results.push({
                ...bookmark,
                score: score + frequencyScore, // 基础分数 + 频率分数
                baseScore: score, // 保留基础分数用于调试
                clickCount, // 保留点击次数
                type: 'bookmark'
            });
        }
    });

    // 按总分排序（基础分数 + 频率分数），取前5个
    results.sort((a, b) => {
        // 如果总分相同，优先显示点击次数多的
        if (Math.abs(a.score - b.score) < 0.1) {
            return b.clickCount - a.clickCount;
        }
        return b.score - a.score;
    });
    return results.slice(0, 5);
}

// 渲染搜索结果（浮窗 & 网页内下拉共用，规则一致）
function renderSearchResults(results, isModal = false) {
    currentSearchResults = results;
    selectedResultIndex = -1;

    if (isModal) {
        // 浮窗模式：渲染到浮窗中
        const resultsContainer = document.getElementById('global-search-results');
        if (resultsContainer) {
            renderResultsToContainer(results, resultsContainer, 'global-search-result-item');
        }
    } else {
        // 网页内下拉模式：渲染到搜索框下方
        showInlineSearchDropdown(results);
    }
}

// 渲染结果到指定容器
function renderResultsToContainer(results, container, itemClass) {
    if (results.length === 0) {
        // 使用DOM API而不是innerHTML
        container.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'global-search-empty';
        emptyDiv.textContent = '暂无匹配的书签';
        container.appendChild(emptyDiv);
        return;
    }

    // 清空容器
    container.textContent = '';

    results.forEach((result, index) => {
        // 创建结果项元素
        const item = document.createElement('div');
        item.className = itemClass;
        item.setAttribute('data-index', index);
        item.setAttribute('data-result-index', index); // 使用索引而不是JSON字符串

        // 获取图标HTML（可能是emoji或img标签）
        // 安全处理：如果包含HTML标签，使用textContent设置，否则直接使用
        let iconHtml = result.icon || '🔗';

        // 创建图标容器
        const iconContainer = document.createElement('div');
        iconContainer.className = 'global-search-result-item-icon';

        // 安全处理图标：使用DOMParser解析HTML，然后安全地插入
        if (iconHtml.includes('<')) {
            // 使用DOMParser安全解析HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(iconHtml, 'text/html');

            // 获取body中的所有子节点
            const bodyNodes = Array.from(doc.body.childNodes);
            bodyNodes.forEach(node => {
                // 只允许img和span标签
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    if (tagName === 'img' || tagName === 'span') {
                        // 克隆节点并清理危险属性
                        const clone = node.cloneNode(true);
                        // 移除所有事件处理器属性
                        Array.from(clone.attributes).forEach(attr => {
                            if (attr.name.startsWith('on')) {
                                clone.removeAttribute(attr.name);
                            }
                        });
                        iconContainer.appendChild(clone);
                    }
                } else if (node.nodeType === Node.TEXT_NODE) {
                    // 文本节点直接添加
                    iconContainer.appendChild(node.cloneNode(true));
                }
            });
        } else {
            iconContainer.textContent = iconHtml;
        }

        // 创建内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'global-search-result-item-content';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'global-search-result-item-title';
        titleDiv.textContent = result.name || '';

        // 根据类型显示不同的内容
        if (result.type === 'function') {
            // 功能项：只显示名称，不显示URL
            contentContainer.appendChild(titleDiv);
        } else {
            // 书签：显示名称和URL
            const urlDiv = document.createElement('div');
            urlDiv.className = 'global-search-result-item-url';
            urlDiv.textContent = result.url || '';
            contentContainer.appendChild(titleDiv);
            contentContainer.appendChild(urlDiv);
        }

        // 组装元素
        item.appendChild(iconContainer);
        item.appendChild(contentContainer);

        // 如果是模态框模式，添加类型标签
        if (itemClass === 'global-search-result-item') {
            const typeDiv = document.createElement('div');
            typeDiv.className = 'global-search-result-item-type';
            typeDiv.textContent = result.type === 'function' ? '功能' : '书签';
            item.appendChild(typeDiv);
        }

        // 绑定鼠标悬停事件
        item.addEventListener('mouseenter', () => {
            const isModal = itemClass === 'global-search-result-item';
            selectSearchResult(index, isModal);
        });

        // 绑定点击事件
        item.addEventListener('click', () => {
            openSearchResult(result);
        });

        container.appendChild(item);
    });

    console.log('[Search] renderResultsToContainer completed, added', results.length, 'items to container');
    console.log('[Search] Container children count:', container.children.length);
}

// 选择搜索结果（浮窗与网页内下拉共用）
window.selectSearchResult = function (index, isModal = false) {
    selectedResultIndex = index;

    document.querySelectorAll('.global-search-result-item').forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });
}

// 导航搜索结果（浮窗与网页内下拉共用）
function navigateResults(direction, isModal = false) {
    if (currentSearchResults.length === 0) return;

    selectedResultIndex += direction;
    if (selectedResultIndex < 0) {
        selectedResultIndex = currentSearchResults.length - 1;
    } else if (selectedResultIndex >= currentSearchResults.length) {
        selectedResultIndex = 0;
    }

    selectSearchResult(selectedResultIndex, isModal);

    // 滚动到选中项（不区分浮窗/下拉，统一处理）
    const selector = `.global-search-result-item[data-index="${selectedResultIndex}"]`;
    const selectedItem = document.querySelector(selector);
    if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// 打开搜索结果
window.openSearchResult = function (result) {
    if (!result) return;

    // 如果result是字符串，尝试解析
    if (typeof result === 'string') {
        try {
            result = JSON.parse(result.replace(/&quot;/g, '"'));
        } catch (e) {
            console.error('[GlobalSearch] 解析结果失败:', e);
            return;
        }
    }

    // 关闭搜索模态框和下拉菜单
    closeSearchModal();
    hideInlineSearchDropdown();

    if (result.type === 'function' && result.action) {
        // 功能项：执行对应的操作
        try {
            result.action();
            console.log('[GlobalSearch] 执行功能:', result.name);
        } catch (error) {
            console.error('[GlobalSearch] 执行功能失败:', error);
        }
    } else if (result.type === 'bookmark' && result.url) {
        // 书签：打开链接
        // 记录点击（用于高频置顶）
        if (dataManager && typeof dataManager.recordBookmarkClick === 'function') {
            dataManager.recordBookmarkClick(result.url, result.name, result.icon).catch(() => { });
            // 更新本地缓存
            const currentCount = clickStatsCache[result.url] || 0;
            clickStatsCache[result.url] = currentCount + 1;
        }

        window.open(result.url, '_blank');
    }
}

// 执行搜索（网络搜索或打开书签）
async function performSearch(query) {
    if (!query || query.trim() === '') return;

    const trimmedQuery = query.trim();

    // 先检查是否有匹配的书签
    const bookmarkResults = searchBookmarks(trimmedQuery.toLowerCase());
    if (bookmarkResults.length > 0 && bookmarkResults[0].score >= 30) {
        // 如果最高分书签相关度足够高，直接打开
        openSearchResult(bookmarkResults[0]);
        return;
    }

    // 否则进行网络搜索
    const searchEngine = window.searchConfig?.searchEngine || 'https://www.bing.com/search?q=';
    const searchUrl = searchEngine + encodeURIComponent(trimmedQuery);
    window.open(searchUrl, '_blank');
    closeSearchModal();
}

// 打开搜索浮窗
window.openSearchModal = async function () {
    const modal = document.getElementById('global-search-modal');
    const modalInput = document.getElementById('global-search-modal-input');

    if (!modal || !modalInput) {
        console.error('[GlobalSearch] 搜索浮窗元素未找到');
        return;
    }

    try {
        // 显示加载状态
        modal.style.display = 'flex';
        modalInput.value = '';
        modalInput.disabled = true;
        modalInput.placeholder = '正在加载书签缓存...';
        renderSearchResults([], true);
        selectedResultIndex = -1;

        // 确保书签缓存已加载（如果缓存为空，先刷新）
        if (!allBookmarksCache || allBookmarksCache.length === 0) {
            console.log('[GlobalSearch] 缓存为空，正在刷新书签缓存...');
            try {
                const success = await refreshBookmarksCache();
                if (!success || !allBookmarksCache || allBookmarksCache.length === 0) {
                    console.warn('[GlobalSearch] 缓存刷新失败或为空');
                    console.warn('[GlobalSearch] 当前缓存状态:', {
                        cacheExists: !!allBookmarksCache,
                        cacheLength: allBookmarksCache ? allBookmarksCache.length : 0,
                        success: success
                    });
                    modalInput.placeholder = '书签缓存加载失败，但可以搜索功能';
                } else {
                    console.log('[GlobalSearch] 缓存刷新成功，共', allBookmarksCache.length, '个书签');
                }
            } catch (refreshError) {
                console.error('[GlobalSearch] 刷新缓存时发生异常:', refreshError);
                modalInput.placeholder = '缓存加载出错，但可以搜索功能';
            }
        } else {
            console.log('[GlobalSearch] 使用现有缓存，共', allBookmarksCache.length, '个书签');
        }

        // 恢复输入框状态（无论缓存是否加载成功，都允许搜索功能）
        modalInput.disabled = false;
        modalInput.placeholder = '搜索书签、功能或使用搜索引擎...';
        modalInput.focus();

        // 确保功能项列表已初始化
        if (!functionItems || !Array.isArray(functionItems) || functionItems.length === 0) {
            console.warn('[GlobalSearch] 功能项列表未初始化');
        } else {
            console.log('[GlobalSearch] 功能项列表已就绪，共', functionItems.length, '个功能');
        }
    } catch (error) {
        console.error('[GlobalSearch] 打开搜索浮窗时发生错误:', error);
        // 即使出错，也尝试恢复输入框状态
        modalInput.disabled = false;
        modalInput.placeholder = '搜索功能或使用搜索引擎...';
        modalInput.focus();
    }
}

// 关闭搜索浮窗
function closeSearchModal() {
    const modal = document.getElementById('global-search-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedResultIndex = -1;
}

// 处理搜索快捷键
function handleSearchShortcut(e) {
    // 从配置中读取快捷键，默认 Ctrl+Space
    const config = window.searchConfig || {};
    let shortcut = (config.shortcut || 'Ctrl+Space').trim();
    if (!shortcut) {
        shortcut = 'Ctrl+Space';
    }

    // 解析快捷键（大小写不敏感）
    const parts = shortcut.split('+').map(s => s.trim()).filter(Boolean);
    const lowerParts = parts.map(p => p.toLowerCase());

    const isCtrl = lowerParts.includes('ctrl');
    const isAlt = lowerParts.includes('alt');
    const isShift = lowerParts.includes('shift');

    // 最后一个片段视为主键
    let keyToken = lowerParts[lowerParts.length - 1] || 'space';

    // 检查是否匹配修饰键（需要什么就必须按下，不需要的就必须没按）
    if (isCtrl !== !!e.ctrlKey) return;
    if (isAlt !== !!e.altKey) return;
    if (isShift !== !!e.shiftKey) return;

    // 检查按键匹配（支持 space / 字母键 等）
    let keyMatch = false;
    if (keyToken === 'space' && e.code === 'Space') {
        keyMatch = true;
    } else if (keyToken.length === 1 && e.key.toLowerCase() === keyToken) {
        keyMatch = true;
    } else if (keyToken.length === 1 && e.code === `Key${keyToken.toUpperCase()}`) {
        keyMatch = true;
    }

    if (!keyMatch) return;

    // 如果正在输入，不触发
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // 但如果是搜索框本身，允许触发
        if (e.target.id !== 'global-search-input' && e.target.id !== 'global-search-modal-input') {
            return;
        }
    }

    e.preventDefault();
    openSearchModal();
}

const BOOKMARK_CARD_BASE_HEIGHT = 98;
const BOOKMARK_CARD_FIRST_ROW_HEIGHT = 30;
const BOOKMARK_CARD_ROW_HEIGHT = 42;
const BOOKMARK_CARD_MIN_HEIGHT = BOOKMARK_CARD_BASE_HEIGHT + BOOKMARK_CARD_FIRST_ROW_HEIGHT;
const BOOKMARK_CARD_MAX_HEIGHT = 2000;
const BOOKMARK_CARD_SIDE_BUFFER = 6;
const DEFAULT_BOOKMARK_CARD_WIDTH_PRESET = '1/4';
const BOOKMARK_CARD_WIDTH_SNAP_PRESETS = [
    { label: '1/4', columns: 4, span: 1 },
    { label: '1/3', columns: 3, span: 1 },
    { label: '1/2', columns: 2, span: 1 },
    { label: '3/4', columns: 4, span: 3 }
];

function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getBookmarkContainerContentWidth(container) {
    if (!container) {
        return 0;
    }

    const styles = window.getComputedStyle(container);
    const paddingLeft = parseFloat(styles.paddingLeft || '0') || 0;
    const paddingRight = parseFloat(styles.paddingRight || '0') || 0;
    return Math.max(220, Math.round(container.clientWidth - paddingLeft - paddingRight - BOOKMARK_CARD_SIDE_BUFFER * 2));
}

function getDefaultBookmarkCardWidth(metrics) {
    const quarterWidth = metrics.widthSnapPoints.find(point => point.label === DEFAULT_BOOKMARK_CARD_WIDTH_PRESET)?.value;
    return quarterWidth || metrics.widthSnapPoints[0]?.value || 220;
}

function normalizeBookmarkCardWidthPreset(preset) {
    if (BOOKMARK_CARD_WIDTH_SNAP_PRESETS.some(point => point.label === preset)) {
        return preset;
    }

    return DEFAULT_BOOKMARK_CARD_WIDTH_PRESET;
}

function getBookmarkCardPresetForWidth(width, metrics) {
    let closestPoint = metrics.widthSnapPoints[0] || null;
    let closestDiff = Infinity;

    metrics.widthSnapPoints.forEach(point => {
        const diff = Math.abs(point.value - width);
        if (diff < closestDiff) {
            closestDiff = diff;
            closestPoint = point;
        }
    });

    return closestPoint?.label || DEFAULT_BOOKMARK_CARD_WIDTH_PRESET;
}

function getBookmarkCardWidthValueForPreset(presetLabel, metrics) {
    return metrics.widthSnapPoints.find(point => point.label === presetLabel)?.value
        || getDefaultBookmarkCardWidth(metrics);
}

function getBookmarkCardPresetFromStoredWidth(widthValue, metrics) {
    if (typeof widthValue === 'string') {
        const trimmed = widthValue.trim();

        if (trimmed === 'collapsed') {
            return 'collapsed';
        }

        if (BOOKMARK_CARD_WIDTH_SNAP_PRESETS.some(point => point.label === trimmed)) {
            return normalizeBookmarkCardWidthPreset(trimmed);
        }
    }

    const clampedWidth = clampBookmarkCardWidthValue(widthValue);
    if (clampedWidth !== null) {
        return getBookmarkCardPresetForWidth(clampedWidth, metrics);
    }

    return DEFAULT_BOOKMARK_CARD_WIDTH_PRESET;
}

function applyBookmarkCardWidthPreset(card, preset) {
    if (!card) {
        return;
    }

    const normalizedPreset = preset === 'collapsed'
        ? 'collapsed'
        : normalizeBookmarkCardWidthPreset(preset);

    card.dataset.cardWidthPreset = normalizedPreset;
    card.style.order = '';
    card.style.gridRow = '';
    card.style.gridColumn = '';

    if (normalizedPreset !== 'collapsed') {
        card.style.width = '';
    }
}

function getBookmarkCardGridSpan(card) {
    const preset = card.dataset.cardWidthPreset === 'collapsed'
        ? 'collapsed'
        : normalizeBookmarkCardWidthPreset(card.dataset.cardWidthPreset);
    if (preset === '1/3') return 4;
    if (preset === '1/2') return 6;
    if (preset === '3/4') return 9;
    if (preset === 'collapsed') return 2;
    return 3;
}

function updateBookmarkCardVisualOrder() {
    const container = document.getElementById('bookmarks-container');
    if (!container) {
        return;
    }

    const domOrder = Array.from(container.querySelectorAll('.bookmark-card'));
    const sortedCards = [...domOrder].sort((a, b) => {
        const ay = parseInt(a.dataset.layoutY || '0', 10) || 0;
        const by = parseInt(b.dataset.layoutY || '0', 10) || 0;
        if (ay !== by) {
            return ay - by;
        }

        const ax = parseInt(a.dataset.layoutX || '0', 10) || 0;
        const bx = parseInt(b.dataset.layoutX || '0', 10) || 0;
        if (ax !== bx) {
            return ax - bx;
        }

        return domOrder.indexOf(a) - domOrder.indexOf(b);
    });

    sortedCards.forEach(card => {
        container.appendChild(card);
        card.style.order = '';
        card.style.gridRow = '';
        card.style.gridColumn = '';
    });
}

function applyBookmarkCardAutoAlign(enabled) {
    const container = document.getElementById('bookmarks-container');
    if (!container) {
        return;
    }

    container.dataset.autoAlign = enabled ? 'true' : 'false';

    window.requestAnimationFrame(() => {
        syncBookmarkCardWidthsToContainer();
        updateBookmarkCardVisualOrder();
        if (window.updateBookmarkScrollbars) {
            window.updateBookmarkScrollbars();
        }
        if (typeof window.renderRightNav === 'function') {
            window.renderRightNav();
        }
    });
}

function getBookmarkCardResizeMetrics(card) {
    const container = document.getElementById('bookmarks-container');
    const cardWidth = Math.round(card.getBoundingClientRect().width) || 260;
    const containerWidth = container ? getBookmarkContainerContentWidth(container) : cardWidth;
    const containerStyles = container ? window.getComputedStyle(container) : null;
    const gap = containerStyles ? (parseFloat(containerStyles.columnGap || containerStyles.gap || '24') || 24) : 24;
    const effectiveContainerWidth = containerWidth;

    const widthSnapPoints = BOOKMARK_CARD_WIDTH_SNAP_PRESETS
        .map(({ label, columns, span = 1 }) => {
            const columnWidth = (effectiveContainerWidth - gap * (columns - 1)) / columns;
            return {
                label,
                value: Math.round(columnWidth * span + gap * (span - 1))
            };
        })
        .filter(point => Number.isFinite(point.value) && point.value > 0)
        .sort((a, b) => a.value - b.value);

    const minWidth = Math.max(180, Math.min(220, widthSnapPoints[0]?.value || 220));
    const maxWidth = Math.max(minWidth, effectiveContainerWidth - 6);

    return {
        minWidth,
        maxWidth,
        minHeight: BOOKMARK_CARD_MIN_HEIGHT,
        maxHeight: BOOKMARK_CARD_MAX_HEIGHT,
        widthSnapPoints
    };
}

function clampBookmarkCardWidthValue(rawWidth) {
    const container = document.getElementById('bookmarks-container');
    const containerWidth = container ? getBookmarkContainerContentWidth(container) : 0;
    const numericWidth = parseInt(String(rawWidth || '').replace(/[^\d]/g, ''), 10);

    if (!Number.isFinite(numericWidth)) {
        return null;
    }

    if (!containerWidth) {
        return Math.max(180, numericWidth);
    }

    return clampNumber(numericWidth, 180, Math.max(220, containerWidth - 6));
}

function clampRenderedBookmarkCardWidths() {
    const container = document.getElementById('bookmarks-container');
    if (container?.classList.contains('bookmarks-free-layout')) {
        return;
    }

    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        const inlineWidth = card.style.width;
        if (!inlineWidth) {
            return;
        }

        const clampedWidth = clampBookmarkCardWidthValue(inlineWidth);
        if (clampedWidth !== null) {
            card.style.setProperty('width', `${clampedWidth}px`, 'important');
        }
    });
}

function syncBookmarkCardWidthsToContainer() {
    const container = document.getElementById('bookmarks-container');
    if (container?.classList.contains('bookmarks-free-layout')) {
        layoutBookmarkCardsFreeform();
        return;
    }

    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        if (card.classList.contains('bookmark-card-collapsed')) {
            applyBookmarkCardWidthPreset(card, 'collapsed');
            return;
        }

        const metrics = getBookmarkCardResizeMetrics(card);
        const storedPreset = card.dataset.cardWidthPreset;
        const preset = storedPreset && storedPreset !== 'collapsed'
            ? normalizeBookmarkCardWidthPreset(storedPreset)
            : getBookmarkCardPresetFromStoredWidth(card.style.width, metrics);

        applyBookmarkCardWidthPreset(card, preset);
    });

    updateBookmarkCardVisualOrder();
}

if (!window.__bookmarkCardWidthClampBound) {
    window.__bookmarkCardWidthClampBound = true;
    window.addEventListener('resize', () => {
        window.requestAnimationFrame(() => {
            const container = document.getElementById('bookmarks-container');
            if (container?.classList.contains('bookmarks-free-layout')) {
                layoutBookmarkCardsFreeform();
            } else {
                syncBookmarkCardWidthsToContainer();
            }
            updateBookmarkScrollbars();
        });
    });
}

function snapBookmarkCardWidth(rawWidth, metrics) {
    const clampedWidth = clampNumber(rawWidth, metrics.minWidth, metrics.maxWidth);
    const tolerance = Math.max(20, Math.round(metrics.maxWidth * 0.025));

    let snappedWidth = clampedWidth;
    let snappedLabel = '';
    let closestDiff = Infinity;

    metrics.widthSnapPoints.forEach(point => {
        const diff = Math.abs(clampedWidth - point.value);
        if (diff <= tolerance && diff < closestDiff) {
            snappedWidth = point.value;
            snappedLabel = point.label;
            closestDiff = diff;
        }
    });

    return {
        value: snappedWidth,
        label: snappedLabel
    };
}

function snapBookmarkCardHeight(rawHeight, metrics) {
    const clampedHeight = clampNumber(rawHeight, metrics.minHeight, metrics.maxHeight);
    const rowCount = Math.max(
        1,
        Math.round((clampedHeight - BOOKMARK_CARD_MIN_HEIGHT) / BOOKMARK_CARD_ROW_HEIGHT) + 1
    );
    const snappedHeight = BOOKMARK_CARD_MIN_HEIGHT + (rowCount - 1) * BOOKMARK_CARD_ROW_HEIGHT;
    return clampNumber(snappedHeight, metrics.minHeight, metrics.maxHeight);
}

function clearBookmarkCardResizeHandles() {
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(bookmarkCard => {
        bookmarkCard.classList.remove(
            'bookmark-card-resizable',
            'bookmark-card-resizing',
            'bookmark-card-resizing-width',
            'bookmark-card-resizing-height'
        );
        bookmarkCard.querySelectorAll('.bookmark-resize-handle-right-edge, .bookmark-resize-handle-bottom-edge').forEach(handle => handle.remove());
    });
    document.body.classList.remove('bookmark-card-resizing-active');
}

function startBookmarkCardResize(event, card, options = {}) {
    if (!card || event.button !== 0) return;

    const categoryName = card.dataset.category;
    if (!categoryName) return;

    const resizeWidth = options.resizeWidth !== false;
    const resizeHeight = options.resizeHeight === true;
    const cursor = options.cursor || (resizeWidth && resizeHeight ? 'nwse-resize' : 'ew-resize');

    event.preventDefault();
    event.stopPropagation();

    const metrics = getBookmarkCardResizeMetrics(card);
    const startWidth = Math.round(card.getBoundingClientRect().width) || 260;
    const startHeight = Math.round(card.getBoundingClientRect().height) || BOOKMARK_CARD_MIN_HEIGHT;
    const startX = event.clientX;
    const startY = event.clientY;
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;

    let latestWidth = startWidth;
    let latestHeight = startHeight;
    let pendingX = startX;
    let pendingY = startY;
    let animationFrameId = null;

    document.body.classList.add('bookmark-card-resizing-active');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = cursor;
    card.classList.add('bookmark-card-resizing');
    card.classList.toggle('bookmark-card-resizing-width', resizeWidth && !resizeHeight);
    card.classList.toggle('bookmark-card-resizing-height', resizeHeight && !resizeWidth);

    const applyPendingResize = () => {
        animationFrameId = null;

        if (resizeWidth) {
            const widthResult = snapBookmarkCardWidth(startWidth + (pendingX - startX), metrics);
            const preset = getBookmarkCardPresetForWidth(widthResult.value, metrics);
            const presetWidth = getBookmarkCardWidthValueForPreset(preset, metrics);

            if (latestWidth !== presetWidth || card.dataset.cardWidthPreset !== preset) {
                latestWidth = presetWidth;
                applyBookmarkCardWidthPreset(card, preset);
            }
        }

        if (resizeHeight) {
            const snappedHeight = snapBookmarkCardHeight(startHeight + (pendingY - startY), metrics);
            if (latestHeight !== snappedHeight) {
                latestHeight = snappedHeight;
                card.style.height = `${latestHeight}px`;
            }
        }
    };

    const queueResizeFrame = () => {
        if (animationFrameId !== null) return;
        animationFrameId = window.requestAnimationFrame(applyPendingResize);
    };

    const handleMouseMove = (moveEvent) => {
        moveEvent.preventDefault();
        pendingX = moveEvent.clientX;
        pendingY = moveEvent.clientY;
        queueResizeFrame();
    };

    const stopResize = async () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResize);
        if (animationFrameId !== null) {
            window.cancelAnimationFrame(animationFrameId);
            applyPendingResize();
        }
        document.body.classList.remove('bookmark-card-resizing-active');
        document.body.style.userSelect = originalUserSelect;
        document.body.style.cursor = originalCursor;
        card.classList.remove(
            'bookmark-card-resizing',
            'bookmark-card-resizing-width',
            'bookmark-card-resizing-height'
        );

        if (window.updateBookmarkScrollbars) {
            window.updateBookmarkScrollbars();
        }
        await saveBookmarkCardSize(categoryName, latestWidth, latestHeight);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
}

window.clearBookmarkCardResizeHandles = clearBookmarkCardResizeHandles;
window.syncBookmarkCardWidthsToContainer = syncBookmarkCardWidthsToContainer;
window.applyBookmarkCardAutoAlign = applyBookmarkCardAutoAlign;
window.updateBookmarkCardVisualOrder = updateBookmarkCardVisualOrder;

window.addBookmarkCardResizeHandles = function (card) {
    clearBookmarkCardResizeHandles();

    if (!card ||
        !card.classList.contains('bookmark-card') ||
        !card.classList.contains('highlighted-card') ||
        card.classList.contains('bookmark-card-collapsed') ||
        !document.body.classList.contains('sidebar-open')) {
        return;
    }

    card.classList.add('bookmark-card-resizable');

    const rightEdgeHandle = document.createElement('button');
    rightEdgeHandle.type = 'button';
    rightEdgeHandle.className = 'bookmark-resize-handle-right-edge';
    rightEdgeHandle.title = '拖动右侧边框调整宽度';
    rightEdgeHandle.setAttribute('aria-label', 'Resize bookmark module width');
    rightEdgeHandle.addEventListener('mousedown', (event) => startBookmarkCardResize(event, card, {
        resizeWidth: true,
        resizeHeight: false,
        cursor: 'ew-resize'
    }));
    rightEdgeHandle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    const bottomEdgeHandle = document.createElement('button');
    bottomEdgeHandle.type = 'button';
    bottomEdgeHandle.className = 'bookmark-resize-handle-bottom-edge';
    bottomEdgeHandle.title = '拖动下侧边框调整高度';
    bottomEdgeHandle.setAttribute('aria-label', 'Resize bookmark module height');
    bottomEdgeHandle.addEventListener('mousedown', (event) => startBookmarkCardResize(event, card, {
        resizeWidth: false,
        resizeHeight: true,
        cursor: 'ns-resize'
    }));
    bottomEdgeHandle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    card.appendChild(rightEdgeHandle);
    card.appendChild(bottomEdgeHandle);
};

// 保存书签卡片大小（供右侧设置面板调用，持久化宽高）
async function saveBookmarkCardSize(categoryName, width, height) {
    try {
        const config = await dataManager.getDashboardConfig();
        if (!config) {
            console.warn('[调整大小] 获取配置失败，无法保存:', categoryName);
            return;
        }

        if (!Array.isArray(config.bookmarkLayout)) {
            config.bookmarkLayout = [];
        }

        let item = config.bookmarkLayout.find(it => it.category === categoryName);
        if (!item) {
            item = {
                category: categoryName,
                index: 999,
                hidden: false,
                collapsed: false
            };
            config.bookmarkLayout.push(item);
        }

        // 保存宽高值，确保保存为数字格式
        const card = document.querySelector(`#bookmarks-container .bookmark-card[data-category="${CSS.escape(categoryName)}"]`);
        const metrics = card ? getBookmarkCardResizeMetrics(card) : null;
        item.widthPreset = card?.dataset.cardWidthPreset && card.dataset.cardWidthPreset !== 'collapsed'
            ? normalizeBookmarkCardWidthPreset(card.dataset.cardWidthPreset)
            : (metrics ? getBookmarkCardPresetFromStoredWidth(width, metrics) : DEFAULT_BOOKMARK_CARD_WIDTH_PRESET);

        if (width !== null && width !== undefined) {
            if (typeof width === 'number') {
                item.width = Math.round(width);
            } else if (typeof width === 'string' && width.trim() !== '') {
                // 如果是字符串，提取数字部分
                const widthMatch = width.match(/(\d+)/);
                if (widthMatch) {
                    item.width = parseInt(widthMatch[1], 10);
                }
            }
        }
        if (height !== null && height !== undefined) {
            if (typeof height === 'number') {
                item.height = Math.round(height);
            } else if (typeof height === 'string' && height.trim() !== '') {
                // 如果是字符串，提取数字部分
                const heightMatch = height.match(/(\d+)/);
                if (heightMatch) {
                    item.height = parseInt(heightMatch[1], 10);
                }
            }
        }

        await dataManager.saveDashboardConfig(config);
        console.log('[调整大小] 已保存到配置:', categoryName, 'width:', item.width, 'height:', item.height);
        console.log('[调整大小] 配置项详情:', JSON.stringify(item));

        // 保存后更新滚动条状态
        setTimeout(() => {
            updateBookmarkScrollbars();
        }, 100);
    } catch (err) {
        console.error('[调整大小] 保存到配置失败:', categoryName, err);
    }
}

// 向全局暴露用于右侧面板调用的尺寸更新函数
window.updateBookmarkCardSize = function (categoryName, width, height) {
    return saveBookmarkCardSize(categoryName, width, height);
};

// 更新书签卡片的滚动条显示/隐藏状态
// 如果书签数量超过卡片显示范围，显示滚动条；否则隐藏
function updateBookmarkScrollbars() {
    const bookmarkCards = document.querySelectorAll('#bookmarks-container .bookmark-card');

    bookmarkCards.forEach(card => {
        const bookmarkGrid = card.querySelector('.bookmark-grid');
        if (!bookmarkGrid) return;

        // 检查内容高度是否超过容器高度
        // scrollHeight: 内容的总高度（包括被滚动隐藏的部分）
        // clientHeight: 可见区域的高度
        const needsScrollbar = bookmarkGrid.scrollHeight > bookmarkGrid.clientHeight;

        if (needsScrollbar) {
            bookmarkGrid.classList.add('show-scrollbar');
        } else {
            bookmarkGrid.classList.remove('show-scrollbar');
        }
    });
}

// 将函数暴露到全局，供其他模块调用
window.updateBookmarkScrollbars = updateBookmarkScrollbars;

// 在initDashboard中初始化搜索功能
const originalInitDashboard = window.initDashboard;
if (typeof initDashboard === 'function') {
    // 如果initDashboard已经定义，我们需要在它执行后初始化搜索
    // 这会在后面处理
}

let todoImageModalKeyHandler = null;

function bindTodosTitleDoubleClickImpl() {
    const todosTitleElement = document.getElementById('todos-title');
    if (!todosTitleElement) return;

    const titleElement = bindReplacingEventHandler(todosTitleElement, 'dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTodosPin();
    });
    if (!titleElement) return;

    titleElement.style.cursor = 'pointer';
    updateTodosPinTooltip();
}

function getTodoImageModalElements() {
    return {
        imageModal: document.getElementById('todo-image-modal'),
        closeBtn: document.getElementById('todo-image-modal-close'),
        imageDisplay: document.getElementById('todo-image-modal-display'),
    };
}

function hideTodoImageModal() {
    const { imageModal } = getTodoImageModalElements();
    if (imageModal) {
        imageModal.style.display = 'none';
    }
}

function ensureTodoImageModal() {
    const { imageModal } = getTodoImageModalElements();
    if (imageModal) {
        return imageModal;
    }

    const createdModal = document.createElement('div');
    createdModal.id = 'todo-image-modal';
    createdModal.className = 'todo-image-modal';
    createdModal.innerHTML = `
        <div class="todo-image-modal-content">
            <button class="todo-image-modal-close" id="todo-image-modal-close">\u00d7</button>
            <img id="todo-image-modal-display" src="" alt="\u5f85\u529e\u4e8b\u9879\u56fe\u7247" style="max-width: 90vw; max-height: 90vh; border-radius: 0.5rem;">
        </div>
    `;
    document.body.appendChild(createdModal);

    const { closeBtn } = getTodoImageModalElements();
    if (closeBtn) {
        closeBtn.addEventListener('click', hideTodoImageModal);
    }

    createdModal.addEventListener('click', (e) => {
        if (e.target === createdModal) {
            hideTodoImageModal();
        }
    });

    if (!todoImageModalKeyHandler) {
        todoImageModalKeyHandler = (e) => {
            const { imageModal: currentModal } = getTodoImageModalElements();
            if (e.key === 'Escape' && currentModal && currentModal.style.display === 'flex') {
                hideTodoImageModal();
            }
        };
        document.addEventListener('keydown', todoImageModalKeyHandler);
    }

    return createdModal;
}

function showTodoImageModalImpl(index) {
    if (index < 0 || index >= todosList.length) return;

    const todo = todosList[index];
    if (!todo.image || todo.image.trim() === '') return;

    const imageModal = ensureTodoImageModal();
    const { imageDisplay } = getTodoImageModalElements();
    if (imageDisplay) {
        imageDisplay.src = todo.image;
    }

    imageModal.style.display = 'flex';
}

function showCustomAlertImpl(message, title = '\u63d0\u793a', type = 'success') {
    return new Promise((resolve) => {
        let isClosed = false;
        let autoCloseTimer = null;
        let keyHandler = null;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'custom-modal-overlay';
        modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center;';

        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.cssText = 'max-width: 450px; background: var(--card-bg, #1e293b); border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1)); border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);';

        const iconColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#8b5cf6';
        const icon = type === 'success' ? 'OK' : type === 'error' ? '!' : 'i';
        const okLabel = '\u786e\u5b9a';

        modal.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: ${iconColor}20; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                    <span style="font-size: 2rem; color: ${iconColor}; font-weight: bold;">${icon}</span>
                </div>
                <h3 style="margin: 0 0 0.75rem 0; color: var(--text-primary, #f1f5f9); font-size: 1.25rem;">${title}</h3>
                <p style="margin: 0 0 1.5rem 0; color: var(--text-secondary, #94a3b8); font-size: 0.95rem; line-height: 1.6; white-space: pre-line;">${message}</p>
                <button class="btn" id="custom-alert-ok" style="background: ${iconColor}; color: white; border: none; padding: 0.5rem 2rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.95rem;">${okLabel}</button>
            </div>
        `;

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);

        const closeModal = () => {
            if (isClosed) {
                return false;
            }

            isClosed = true;
            if (autoCloseTimer) {
                clearTimeout(autoCloseTimer);
            }
            if (keyHandler) {
                document.removeEventListener('keydown', keyHandler);
            }
            if (modalOverlay.parentNode) {
                document.body.removeChild(modalOverlay);
            }
            resolve();
            return true;
        };

        const okBtn = modal.querySelector('#custom-alert-ok');
        okBtn.onclick = (e) => {
            e.stopPropagation();
            closeModal();
        };

        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        };

        modal.onclick = (e) => {
            if (e.target !== okBtn && !okBtn.contains(e.target)) {
                closeModal();
            }
        };

        keyHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', keyHandler);

        autoCloseTimer = setTimeout(() => {
            if (modalOverlay.parentNode) {
                closeModal();
            }
        }, 3000);
    });
}

function showCustomConfirmImpl(message, title = '\u786e\u8ba4\u64cd\u4f5c') {
    return new Promise((resolve) => {
        let isSettled = false;
        let keyHandler = null;

        const modal = document.getElementById('custom-confirm-modal');
        const msgEl = document.getElementById('custom-confirm-message');
        const titleEl = document.getElementById('custom-confirm-title');
        const okBtn = document.getElementById('custom-confirm-ok');
        const cancelBtn = document.getElementById('custom-confirm-cancel');

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            resolve(confirm(message));
            return;
        }

        msgEl.innerText = message;
        if (titleEl) titleEl.innerText = title;

        modal.classList.add('show');

        const cleanup = (result) => {
            if (isSettled) {
                return false;
            }

            isSettled = true;
            modal.classList.remove('show');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
            if (keyHandler) {
                document.removeEventListener('keydown', keyHandler);
            }
            resolve(result);
            return true;
        };

        okBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            cleanup(true);
        };

        cancelBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            cleanup(false);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup(false);
            }
        };

        keyHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                cleanup(true);
            }
        };
        document.addEventListener('keydown', keyHandler);

        setTimeout(() => {
            if (okBtn) {
                okBtn.focus();
            }
        }, 100);
    });
}

const BOOKMARK_LAYOUT_GRID_SIZE = 24;
const BOOKMARK_LAYOUT_GAP = BOOKMARK_LAYOUT_GRID_SIZE;
const BOOKMARK_LAYOUT_MIN_WIDTH = 216;
const BOOKMARK_LAYOUT_MIN_HEIGHT = 72;
const BOOKMARK_LAYOUT_COLLAPSED_WIDTH = 100;
const BOOKMARK_LAYOUT_COLLAPSED_HEIGHT = 70;

let activeBookmarkFreeDrag = null;
let bookmarkFreeDragAnimationFrame = null;
let pendingBookmarkFreeDrag = null;
let bookmarkLayoutRealtimeSaveTimer = null;
let bookmarkLayoutRealtimeSavePromise = null;

function getBookmarkLayoutContainerMetrics() {
    const container = document.getElementById('bookmarks-container');
    if (!container) return null;

    const styles = window.getComputedStyle(container);
    const paddingLeft = parseFloat(styles.paddingLeft || '0') || 0;
    const paddingRight = parseFloat(styles.paddingRight || '0') || 0;
    const paddingTop = parseFloat(styles.paddingTop || '0') || 0;
    const paddingBottom = parseFloat(styles.paddingBottom || '0') || 0;
    const innerWidth = Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, Math.round(container.clientWidth - paddingLeft - paddingRight));

    return {
        container,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        innerWidth
    };
}

function snapBookmarkLayoutValue(value) {
    return Math.round(value / BOOKMARK_LAYOUT_GRID_SIZE) * BOOKMARK_LAYOUT_GRID_SIZE;
}

function parseBookmarkLayoutNumber(value) {
    const parsed = parseInt(String(value ?? '').replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function getDefaultBookmarkLayoutWidth(metrics) {
    if (!metrics) {
        return BOOKMARK_LAYOUT_MIN_WIDTH;
    }

    const estimated = Math.round((metrics.innerWidth - BOOKMARK_LAYOUT_GRID_SIZE * 3) / 4);
    return Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, snapBookmarkLayoutValue(estimated));
}

function clampBookmarkLayoutWidth(width, metrics, maxWidth = null) {
    const innerWidth = metrics?.innerWidth || BOOKMARK_LAYOUT_MIN_WIDTH;
    const upperBound = Number.isFinite(maxWidth)
        ? Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, snapBookmarkLayoutValue(maxWidth))
        : innerWidth;
    return Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, Math.min(snapBookmarkLayoutValue(width), upperBound));
}

function clampBookmarkLayoutHeight(height) {
    return Math.max(BOOKMARK_LAYOUT_MIN_HEIGHT, snapBookmarkLayoutValue(height));
}

function setBookmarkCardLayoutData(card, layout) {
    card.dataset.layoutX = String(layout.x);
    card.dataset.layoutY = String(layout.y);
    card.dataset.layoutWidth = String(layout.width);
    card.dataset.layoutHeight = String(layout.height);
}

function getBookmarkCardLayoutData(card, metrics) {
    const isCollapsed = card.classList.contains('bookmark-card-collapsed');
    const width = isCollapsed
        ? BOOKMARK_LAYOUT_COLLAPSED_WIDTH
        : clampBookmarkLayoutWidth(
            parseBookmarkLayoutNumber(card.dataset.layoutWidth) || parseBookmarkLayoutNumber(card.style.width) || getDefaultBookmarkLayoutWidth(metrics),
            metrics
        );
    const height = isCollapsed
        ? BOOKMARK_LAYOUT_COLLAPSED_HEIGHT
        : clampBookmarkLayoutHeight(
            parseBookmarkLayoutNumber(card.dataset.layoutHeight) || parseBookmarkLayoutNumber(card.style.height) || BOOKMARK_CARD_MIN_HEIGHT
        );
    const maxX = Math.max(0, (metrics?.innerWidth || width) - width);
    const x = Math.max(0, Math.min(snapBookmarkLayoutValue(parseBookmarkLayoutNumber(card.dataset.layoutX) || 0), maxX));
    const y = Math.max(0, snapBookmarkLayoutValue(parseBookmarkLayoutNumber(card.dataset.layoutY) || 0));

    return { x, y, width, height };
}

function getBookmarkCardRectFromLayout(layout) {
    return {
        left: layout.x,
        top: layout.y,
        right: layout.x + layout.width,
        bottom: layout.y + layout.height
    };
}

function getBookmarkCardSpacingRect(layout) {
    const halfGap = BOOKMARK_LAYOUT_GAP / 2;
    return {
        left: layout.x - halfGap,
        top: layout.y - halfGap,
        right: layout.x + layout.width + halfGap,
        bottom: layout.y + layout.height + halfGap
    };
}

function getBookmarkCardOverlapArea(rectA, rectB) {
    const overlapWidth = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
    const overlapHeight = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
    return overlapWidth * overlapHeight;
}

function getBookmarkCardOverlapEntries(sourceCard, layout, metrics) {
    const sourceRect = getBookmarkCardSpacingRect(layout);
    return Array.from(document.querySelectorAll('#bookmarks-container .bookmark-card'))
        .filter(card => card !== sourceCard && window.getComputedStyle(card).display !== 'none')
        .map(card => ({
            card,
            layout: getBookmarkCardLayoutData(card, metrics),
            rect: getBookmarkCardSpacingRect(getBookmarkCardLayoutData(card, metrics))
        }))
        .map(entry => ({
            ...entry,
            area: getBookmarkCardOverlapArea(sourceRect, entry.rect)
        }))
        .filter(entry => entry.area > 0)
        .sort((a, b) => b.area - a.area);
}

function getMaxBookmarkLayoutBottom(excludeCard, metrics) {
    let maxBottom = 0;
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        if (card === excludeCard || window.getComputedStyle(card).display === 'none') {
            return;
        }
        const layout = getBookmarkCardLayoutData(card, metrics);
        maxBottom = Math.max(maxBottom, layout.y + layout.height);
    });
    return maxBottom;
}

function getBookmarkLayoutOverlapEntriesForPlaced(layout, placedEntries) {
    const sourceRect = getBookmarkCardSpacingRect(layout);
    return placedEntries
        .map(entry => {
            const rect = getBookmarkCardSpacingRect(entry.layout);
            return {
                ...entry,
                rect,
                area: getBookmarkCardOverlapArea(sourceRect, rect)
            };
        })
        .filter(entry => entry.area > 0)
        .sort((a, b) => b.area - a.area);
}

function getMaxBookmarkLayoutBottomFromPlaced(placedEntries) {
    return placedEntries.reduce((maxBottom, entry) => {
        return Math.max(maxBottom, entry.layout.y + entry.layout.height);
    }, 0);
}

function normalizeBookmarkLayout(layout, metrics) {
    const snappedX = Math.max(0, snapBookmarkLayoutValue(layout.x));
    const width = clampBookmarkLayoutWidth(layout.width, metrics, metrics.innerWidth - snappedX);
    const height = clampBookmarkLayoutHeight(layout.height);
    const maxX = Math.max(0, metrics.innerWidth - width);

    return {
        x: Math.max(0, Math.min(snappedX, maxX)),
        y: Math.max(0, snapBookmarkLayoutValue(layout.y)),
        width,
        height
    };
}

function findNearestAvailableBookmarkLayoutFromPlaced(proposedLayout, metrics, placedEntries) {
    const normalized = normalizeBookmarkLayout(proposedLayout, metrics);
    if (getBookmarkLayoutOverlapEntriesForPlaced(normalized, placedEntries).length === 0) {
        return normalized;
    }

    const maxBottom = Math.max(normalized.y, getMaxBookmarkLayoutBottomFromPlaced(placedEntries)) + BOOKMARK_LAYOUT_GRID_SIZE * 12;
    const maxX = Math.max(0, metrics.innerWidth - normalized.width);
    let bestLayout = null;
    let bestDistance = Infinity;

    for (let y = 0; y <= maxBottom; y += BOOKMARK_LAYOUT_GRID_SIZE) {
        for (let x = 0; x <= maxX; x += BOOKMARK_LAYOUT_GRID_SIZE) {
            const candidate = { ...normalized, x, y };
            if (getBookmarkLayoutOverlapEntriesForPlaced(candidate, placedEntries).length > 0) {
                continue;
            }

            const distance = Math.abs(candidate.x - normalized.x) + Math.abs(candidate.y - normalized.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestLayout = candidate;
            }
        }
    }

    if (bestLayout) {
        return bestLayout;
    }

    return {
        ...normalized,
        x: 0,
        y: snapBookmarkLayoutValue(getMaxBookmarkLayoutBottomFromPlaced(placedEntries) + BOOKMARK_LAYOUT_GRID_SIZE)
    };
}

function findFirstAvailableBookmarkLayout(layout, metrics, placedEntries) {
    const normalized = normalizeBookmarkLayout({
        x: 0,
        y: 0,
        width: layout.width,
        height: layout.height
    }, metrics);
    const maxBottom = Math.max(getMaxBookmarkLayoutBottomFromPlaced(placedEntries), normalized.y) + BOOKMARK_LAYOUT_GRID_SIZE * 12;
    const maxX = Math.max(0, metrics.innerWidth - normalized.width);

    for (let y = 0; y <= maxBottom; y += BOOKMARK_LAYOUT_GRID_SIZE) {
        for (let x = 0; x <= maxX; x += BOOKMARK_LAYOUT_GRID_SIZE) {
            const candidate = { ...normalized, x, y };
            if (getBookmarkLayoutOverlapEntriesForPlaced(candidate, placedEntries).length === 0) {
                return candidate;
            }
        }
    }

    return {
        ...normalized,
        x: 0,
        y: snapBookmarkLayoutValue(getMaxBookmarkLayoutBottomFromPlaced(placedEntries) + BOOKMARK_LAYOUT_GRID_SIZE)
    };
}

function findNextAvailableBookmarkLayoutFromPlaced(layout, metrics, placedEntries) {
    const normalized = normalizeBookmarkLayout(layout, metrics);
    if (getBookmarkLayoutOverlapEntriesForPlaced(normalized, placedEntries).length === 0) {
        return normalized;
    }

    const maxX = Math.max(0, metrics.innerWidth - normalized.width);
    const maxBottom = Math.max(
        normalized.y,
        getMaxBookmarkLayoutBottomFromPlaced(placedEntries)
    ) + BOOKMARK_LAYOUT_GRID_SIZE * 16;

    for (let y = normalized.y; y <= maxBottom; y += BOOKMARK_LAYOUT_GRID_SIZE) {
        const startX = y === normalized.y ? normalized.x : 0;
        for (let x = startX; x <= maxX; x += BOOKMARK_LAYOUT_GRID_SIZE) {
            const candidate = { ...normalized, x, y };
            if (getBookmarkLayoutOverlapEntriesForPlaced(candidate, placedEntries).length === 0) {
                return candidate;
            }
        }
    }

    return {
        ...normalized,
        x: 0,
        y: snapBookmarkLayoutValue(getMaxBookmarkLayoutBottomFromPlaced(placedEntries) + BOOKMARK_LAYOUT_GRID_SIZE)
    };
}

function resolveBookmarkLayoutsForResize(sourceCard, proposedLayout, metrics, edges) {
    const sourceLayout = normalizeBookmarkLayout(proposedLayout, metrics);

    if (!(edges.right || edges.bottom) || edges.left || edges.top) {
        return null;
    }

    const resolvedLayouts = new Map();
    const placedEntries = [{ card: sourceCard, layout: sourceLayout }];
    resolvedLayouts.set(sourceCard, sourceLayout);

    Array.from(document.querySelectorAll('#bookmarks-container .bookmark-card')).forEach(card => {
        if (card === sourceCard || window.getComputedStyle(card).display === 'none') {
            return;
        }

        const currentLayout = getBookmarkCardLayoutData(card, metrics);
        const nextLayout = findNextAvailableBookmarkLayoutFromPlaced(currentLayout, metrics, placedEntries);
        placedEntries.push({ card, layout: nextLayout });
        resolvedLayouts.set(card, nextLayout);
    });

    return resolvedLayouts;
}

function applyResolvedBookmarkLayouts(resolvedLayouts) {
    if (!(resolvedLayouts instanceof Map) || resolvedLayouts.size === 0) {
        return;
    }

    resolvedLayouts.forEach((layout, card) => {
        setBookmarkCardLayoutData(card, layout);
    });
}

function findNearestAvailableBookmarkLayout(sourceCard, proposedLayout, metrics) {
    const normalized = normalizeBookmarkLayout(proposedLayout, metrics);
    if (getBookmarkCardOverlapEntries(sourceCard, normalized, metrics).length === 0) {
        return normalized;
    }

    const maxBottom = Math.max(normalized.y, getMaxBookmarkLayoutBottom(sourceCard, metrics)) + BOOKMARK_LAYOUT_GRID_SIZE * 12;
    const yCandidates = [];
    for (let y = 0; y <= maxBottom; y += BOOKMARK_LAYOUT_GRID_SIZE) {
        yCandidates.push(y);
    }

    const xCandidates = [];
    const maxX = Math.max(0, metrics.innerWidth - normalized.width);
    for (let x = 0; x <= maxX; x += BOOKMARK_LAYOUT_GRID_SIZE) {
        xCandidates.push(x);
    }

    let bestLayout = normalized;
    let bestDistance = Infinity;

    yCandidates.forEach(y => {
        xCandidates.forEach(x => {
            const candidate = { ...normalized, x, y };
            if (getBookmarkCardOverlapEntries(sourceCard, candidate, metrics).length > 0) {
                return;
            }

            const distance = Math.abs(candidate.x - normalized.x) + Math.abs(candidate.y - normalized.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestLayout = candidate;
            }
        });
    });

    return bestLayout;
}

function resolveBookmarkResizeLayout(sourceCard, proposedLayout, metrics, edges) {
    let layout = normalizeBookmarkLayout(proposedLayout, metrics);
    let overlaps = getBookmarkCardOverlapEntries(sourceCard, layout, metrics);
    let guard = 0;

    while (overlaps.length > 0 && guard < 24) {
        const entry = overlaps[0];
        const rect = entry.rect;
        const right = layout.x + layout.width;
        const bottom = layout.y + layout.height;

        if (edges.left) {
            layout.x = Math.max(0, snapBookmarkLayoutValue(rect.right));
            layout.width = Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, snapBookmarkLayoutValue(right - layout.x));
        } else if (edges.right) {
            layout.width = Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, snapBookmarkLayoutValue(rect.left - layout.x));
        }

        if (edges.top) {
            layout.y = Math.max(0, snapBookmarkLayoutValue(rect.bottom));
            layout.height = Math.max(BOOKMARK_LAYOUT_MIN_HEIGHT, snapBookmarkLayoutValue(bottom - layout.y));
        } else if (edges.bottom) {
            layout.height = Math.max(BOOKMARK_LAYOUT_MIN_HEIGHT, snapBookmarkLayoutValue(rect.top - layout.y));
        }

        layout = normalizeBookmarkLayout(layout, metrics);
        overlaps = getBookmarkCardOverlapEntries(sourceCard, layout, metrics);
        guard += 1;
    }

    return layout;
}

function findBookmarkCardSwapTarget(sourceCard, targetLayout, metrics) {
    const sourceRect = getBookmarkCardRectFromLayout(targetLayout);
    let bestTarget = null;
    let bestArea = 0;

    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        if (card === sourceCard || window.getComputedStyle(card).display === 'none') {
            return;
        }

        const rect = getBookmarkCardRectFromLayout(getBookmarkCardLayoutData(card, metrics));
        const area = getBookmarkCardOverlapArea(sourceRect, rect);
        if (area > bestArea) {
            bestArea = area;
            bestTarget = card;
        }
    });

    return bestArea > 0 ? bestTarget : null;
}

function layoutBookmarkCardsFreeform() {
    const metrics = getBookmarkLayoutContainerMetrics();
    if (!metrics) return;

    const { container, paddingLeft, paddingTop, paddingBottom } = metrics;
    container.classList.add('bookmarks-free-layout');
    const placedEntries = [];
    let maxBottom = 0;

    Array.from(container.querySelectorAll('.bookmark-card')).forEach(card => {
        if (window.getComputedStyle(card).display === 'none') {
            return;
        }

        const hasStoredX = parseBookmarkLayoutNumber(card.dataset.layoutX) !== null;
        const hasStoredY = parseBookmarkLayoutNumber(card.dataset.layoutY) !== null;
        const baseLayout = getBookmarkCardLayoutData(card, metrics);
        const layout = (hasStoredX && hasStoredY)
            ? findNearestAvailableBookmarkLayoutFromPlaced(baseLayout, metrics, placedEntries)
            : findFirstAvailableBookmarkLayout(baseLayout, metrics, placedEntries);

        setBookmarkCardLayoutData(card, layout);
        placedEntries.push({ card, layout });
        card.style.position = 'absolute';
        card.style.left = `${paddingLeft + layout.x}px`;
        card.style.top = `${paddingTop + layout.y}px`;
        card.style.setProperty('--bookmark-free-layout-width', `${layout.width}px`);
        card.style.width = `${layout.width}px`;
        card.style.height = `${layout.height}px`;
        maxBottom = Math.max(maxBottom, layout.y + layout.height);
    });

    container.style.minHeight = `${paddingTop + maxBottom + paddingBottom + BOOKMARK_LAYOUT_GRID_SIZE}px`;
    refreshBookmarkCardResizeHandles();
}

async function saveBookmarkCardFreeLayout(categoryName) {
    const card = document.querySelector(`#bookmarks-container .bookmark-card[data-category="${CSS.escape(categoryName)}"]`);
    if (!card) return;

    const config = await dataManager.getDashboardConfig();
    if (!Array.isArray(config.bookmarkLayout)) {
        config.bookmarkLayout = [];
    }

    let item = config.bookmarkLayout.find(it => it.category === categoryName);
    if (!item) {
        item = {
            category: categoryName,
            index: 999,
            hidden: false,
            collapsed: false
        };
        config.bookmarkLayout.push(item);
    }

    item.x = parseBookmarkLayoutNumber(card.dataset.layoutX) || 0;
    item.y = parseBookmarkLayoutNumber(card.dataset.layoutY) || 0;
    item.width = parseBookmarkLayoutNumber(card.dataset.layoutWidth) || parseBookmarkLayoutNumber(card.style.width) || getDefaultBookmarkLayoutWidth(getBookmarkLayoutContainerMetrics());
    item.height = parseBookmarkLayoutNumber(card.dataset.layoutHeight) || parseBookmarkLayoutNumber(card.style.height) || BOOKMARK_CARD_MIN_HEIGHT;

    await dataManager.saveDashboardConfig(config);
}

function getBookmarkDragTargetLayout(clientX, clientY, card) {
    const metrics = getBookmarkLayoutContainerMetrics();
    if (!metrics || !card) return null;

    const width = parseBookmarkLayoutNumber(card.dataset.layoutWidth) || Math.round(card.getBoundingClientRect().width);
    const height = parseBookmarkLayoutNumber(card.dataset.layoutHeight) || Math.round(card.getBoundingClientRect().height);
    const rect = metrics.container.getBoundingClientRect();

    const rawX = clientX - rect.left - metrics.paddingLeft - activeBookmarkFreeDrag.pointerOffsetX;
    const rawY = clientY - rect.top - metrics.paddingTop - activeBookmarkFreeDrag.pointerOffsetY;
    const maxX = Math.max(0, metrics.innerWidth - width);

    return {
        x: Math.max(0, Math.min(snapBookmarkLayoutValue(rawX), maxX)),
        y: Math.max(0, snapBookmarkLayoutValue(rawY)),
        width,
        height
    };
}

function clearBookmarkSwapTargets() {
    document.querySelectorAll('#bookmarks-container .bookmark-card.bookmark-card-swap-target').forEach(card => {
        card.classList.remove('bookmark-card-swap-target');
    });
}

function renderBookmarkFreeDragFrame() {
    bookmarkFreeDragAnimationFrame = null;
    if (!activeBookmarkFreeDrag) return;

    const { card, lastClientX, lastClientY } = activeBookmarkFreeDrag;
    const metrics = getBookmarkLayoutContainerMetrics();
    const targetLayout = getBookmarkDragTargetLayout(lastClientX, lastClientY, card);
    if (!metrics || !targetLayout) return;

    const cardRect = card.getBoundingClientRect();
    card.style.position = 'fixed';
    card.style.left = `${lastClientX - activeBookmarkFreeDrag.pointerOffsetX}px`;
    card.style.top = `${lastClientY - activeBookmarkFreeDrag.pointerOffsetY}px`;
    card.style.setProperty('--bookmark-free-layout-width', `${cardRect.width}px`);
    card.style.width = `${cardRect.width}px`;
    card.style.height = `${cardRect.height}px`;

    clearBookmarkSwapTargets();
    activeBookmarkFreeDrag.pendingLayout = targetLayout;
    activeBookmarkFreeDrag.swapTarget = findBookmarkCardSwapTarget(card, targetLayout, metrics);
    if (activeBookmarkFreeDrag.swapTarget) {
        activeBookmarkFreeDrag.swapTarget.classList.add('bookmark-card-swap-target');
    }
}

function queueBookmarkFreeDragFrame(clientX, clientY) {
    if (!activeBookmarkFreeDrag) return;
    activeBookmarkFreeDrag.lastClientX = clientX;
    activeBookmarkFreeDrag.lastClientY = clientY;
    if (bookmarkFreeDragAnimationFrame !== null) return;
    bookmarkFreeDragAnimationFrame = requestAnimationFrame(renderBookmarkFreeDragFrame);
}

function cleanupPendingBookmarkFreeDrag() {
    document.removeEventListener('mousemove', handlePendingBookmarkFreeDragMove);
    document.removeEventListener('mouseup', handlePendingBookmarkFreeDragEnd);
    pendingBookmarkFreeDrag = null;
}

function beginBookmarkFreeDrag(pendingState, clientX, clientY) {
    const { card, pointerOffsetX, pointerOffsetY, pendingLayout } = pendingState;

    activeBookmarkFreeDrag = {
        card,
        pointerOffsetX,
        pointerOffsetY,
        startClientX: pendingState.startClientX,
        startClientY: pendingState.startClientY,
        lastClientX: clientX,
        lastClientY: clientY,
        pendingLayout,
        swapTarget: null
    };

    card.classList.add('bookmark-card-free-dragging');
    card.style.zIndex = '2500';
    card.style.pointerEvents = 'none';
    card.style.transition = 'none';
    card.style.animation = 'none';

    document.addEventListener('mousemove', handleBookmarkFreeDragMove);
    document.addEventListener('mouseup', handleBookmarkFreeDragEnd);
    queueBookmarkFreeDragFrame(clientX, clientY);
}

function cleanupBookmarkFreeDragState() {
    if (bookmarkFreeDragAnimationFrame !== null) {
        cancelAnimationFrame(bookmarkFreeDragAnimationFrame);
        bookmarkFreeDragAnimationFrame = null;
    }
    clearBookmarkSwapTargets();
    document.removeEventListener('mousemove', handleBookmarkFreeDragMove);
    document.removeEventListener('mouseup', handleBookmarkFreeDragEnd);
    if (activeBookmarkFreeDrag?.card) {
        activeBookmarkFreeDrag.card.classList.remove('bookmark-card-free-dragging');
        activeBookmarkFreeDrag.card.style.position = '';
        activeBookmarkFreeDrag.card.style.left = '';
        activeBookmarkFreeDrag.card.style.top = '';
        activeBookmarkFreeDrag.card.style.removeProperty('--bookmark-free-layout-width');
        activeBookmarkFreeDrag.card.style.zIndex = '';
        activeBookmarkFreeDrag.card.style.pointerEvents = '';
        activeBookmarkFreeDrag.card.style.transform = '';
        activeBookmarkFreeDrag.card.style.opacity = '';
        activeBookmarkFreeDrag.card.style.boxShadow = '';
        activeBookmarkFreeDrag.card.style.transition = '';
        activeBookmarkFreeDrag.card.style.animation = '';
    }
    activeBookmarkFreeDrag = null;
}

function handleBookmarkFreeDragMove(event) {
    if (!activeBookmarkFreeDrag) return;
    event.preventDefault();
    queueBookmarkFreeDragFrame(event.clientX, event.clientY);
}

function handlePendingBookmarkFreeDragMove(event) {
    if (!pendingBookmarkFreeDrag) return;

    const movedX = Math.abs(event.clientX - pendingBookmarkFreeDrag.startClientX);
    const movedY = Math.abs(event.clientY - pendingBookmarkFreeDrag.startClientY);
    if (Math.max(movedX, movedY) < 6) {
        return;
    }

    const pendingState = pendingBookmarkFreeDrag;
    cleanupPendingBookmarkFreeDrag();
    event.preventDefault();
    event.stopPropagation();
    beginBookmarkFreeDrag(pendingState, event.clientX, event.clientY);
}

function handlePendingBookmarkFreeDragEnd() {
    cleanupPendingBookmarkFreeDrag();
}

async function handleBookmarkFreeDragEnd(event) {
    if (!activeBookmarkFreeDrag) return;

    const dragState = activeBookmarkFreeDrag;
    const sourceCard = dragState.card;
    const cardIndex = sourceCard && typeof window.getCardControlIndex === 'function'
        ? window.getCardControlIndex(sourceCard)
        : -1;
    const movedX = Math.abs((dragState.lastClientX || 0) - (dragState.startClientX || 0));
    const movedY = Math.abs((dragState.lastClientY || 0) - (dragState.startClientY || 0));
    const sourceCategory = sourceCard.dataset.category;
    const sourceStartX = parseBookmarkLayoutNumber(sourceCard.dataset.layoutX) || 0;
    const sourceStartY = parseBookmarkLayoutNumber(sourceCard.dataset.layoutY) || 0;
    const pendingLayout = dragState.pendingLayout || getBookmarkDragTargetLayout(event.clientX, event.clientY, sourceCard);
    const swapTarget = dragState.swapTarget;

    cleanupBookmarkFreeDragState();

    if (Math.max(movedX, movedY) < 6) {
        if (cardIndex >= 0 && typeof window.highlightCardControl === 'function') {
            window.highlightCardControl(cardIndex, true, false);
        }
        return;
    }

    const syncBookmarkOrderPanels = async (focusCategory) => {
        if (typeof window.updateBookmarkCardVisualOrder === 'function') {
            window.updateBookmarkCardVisualOrder();
        }
        if (typeof window.renderCardControls === 'function') {
            await window.renderCardControls();
        }
        if (typeof window.renderRightNav === 'function') {
            window.renderRightNav();
        }
        if (focusCategory) {
            const focusedCard = document.querySelector(`#bookmarks-container .bookmark-card[data-category="${CSS.escape(focusCategory)}"]`);
            const nextIndex = focusedCard && typeof window.getCardControlIndex === 'function'
                ? window.getCardControlIndex(focusedCard)
                : -1;
            if (nextIndex >= 0 && typeof window.highlightCardControl === 'function') {
                window.highlightCardControl(nextIndex, false, false);
            }
        }
    };

    if (swapTarget) {
        const targetLayout = getBookmarkCardLayoutData(swapTarget, getBookmarkLayoutContainerMetrics());
        sourceCard.dataset.layoutX = String(targetLayout.x);
        sourceCard.dataset.layoutY = String(targetLayout.y);
        swapTarget.dataset.layoutX = String(sourceStartX);
        swapTarget.dataset.layoutY = String(sourceStartY);
        layoutBookmarkCardsFreeform();
        await Promise.all([
            saveBookmarkCardFreeLayout(sourceCategory),
            swapTarget.dataset.category ? saveBookmarkCardFreeLayout(swapTarget.dataset.category) : Promise.resolve()
        ]);
        await syncBookmarkOrderPanels(sourceCategory);
        return;
    }

    if (pendingLayout) {
        const resolvedLayout = findNearestAvailableBookmarkLayout(sourceCard, pendingLayout, getBookmarkLayoutContainerMetrics());
        setBookmarkCardLayoutData(sourceCard, resolvedLayout);
        layoutBookmarkCardsFreeform();
        await saveBookmarkCardFreeLayout(sourceCategory);
        await syncBookmarkOrderPanels(sourceCategory);
    }
}

function handleBookmarkFreeDragStart(event) {
    if (!document.body.classList.contains('sidebar-open')) return;
    if (event.button !== 0) return;
    if (event.target.closest('.bookmark-item-wrapper, .bookmark-item, a, button, input, textarea, label, .bookmark-resize-handle-right-edge, .bookmark-resize-handle-left-edge, .bookmark-resize-handle-top-edge, .bookmark-resize-handle-bottom-edge')) {
        return;
    }

    const card = event.currentTarget;
    if (!card || card.classList.contains('bookmark-card-collapsed')) return;

    const rect = card.getBoundingClientRect();

    pendingBookmarkFreeDrag = {
        card,
        pointerOffsetX: event.clientX - rect.left,
        pointerOffsetY: event.clientY - rect.top,
        pendingLayout: getBookmarkCardLayoutData(card, getBookmarkLayoutContainerMetrics()),
        startClientX: event.clientX,
        startClientY: event.clientY
    };

    document.addEventListener('mousemove', handlePendingBookmarkFreeDragMove);
    document.addEventListener('mouseup', handlePendingBookmarkFreeDragEnd);
}

window.enableBookmarkCardSort = function () {
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        if (card.dataset.bookmarkFreeMoveBound === 'true') return;
        card.dataset.bookmarkFreeMoveBound = 'true';
        card.addEventListener('mousedown', handleBookmarkFreeDragStart);
    });
    refreshBookmarkCardResizeHandles();
};

window.disableBookmarkCardSort = function () {
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        card.removeEventListener('mousedown', handleBookmarkFreeDragStart);
        delete card.dataset.bookmarkFreeMoveBound;
        card.classList.remove('bookmark-card-free-dragging', 'bookmark-card-swap-target');
    });
    cleanupPendingBookmarkFreeDrag();
    cleanupBookmarkFreeDragState();
    if (window.clearBookmarkCardResizeHandles) {
        window.clearBookmarkCardResizeHandles();
    }
};

window.clearBookmarkCardResizeHandles = function () {
    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(bookmarkCard => {
        bookmarkCard.classList.remove(
            'bookmark-card-resizable',
            'bookmark-card-resizing',
            'bookmark-card-resizing-width',
            'bookmark-card-resizing-height'
        );
        bookmarkCard.querySelectorAll('.bookmark-resize-handle-right-edge, .bookmark-resize-handle-left-edge, .bookmark-resize-handle-top-edge, .bookmark-resize-handle-bottom-edge').forEach(handle => handle.remove());
    });
    document.body.classList.remove('bookmark-card-resizing-active');
};

updateBookmarkCardVisualOrder = function () {
    const container = document.getElementById('bookmarks-container');
    if (!container) {
        return;
    }

    const domOrder = Array.from(container.querySelectorAll('.bookmark-card'));
    const sortedCards = [...domOrder].sort((a, b) => {
        const ay = parseInt(a.dataset.layoutY || '0', 10) || 0;
        const by = parseInt(b.dataset.layoutY || '0', 10) || 0;
        if (ay !== by) {
            return ay - by;
        }

        const ax = parseInt(a.dataset.layoutX || '0', 10) || 0;
        const bx = parseInt(b.dataset.layoutX || '0', 10) || 0;
        if (ax !== bx) {
            return ax - bx;
        }

        return domOrder.indexOf(a) - domOrder.indexOf(b);
    });

    sortedCards.forEach((card) => {
        container.appendChild(card);
        card.style.order = '';
        card.style.gridRow = '';
        card.style.gridColumn = '';
    });
};
applyBookmarkCardAutoAlign = function () {};
syncBookmarkCardWidthsToContainer = function () {
    layoutBookmarkCardsFreeform();
    if (typeof window.updateBookmarkCardVisualOrder === 'function') {
        window.updateBookmarkCardVisualOrder();
    }
};
window.updateBookmarkCardVisualOrder = updateBookmarkCardVisualOrder;
window.applyBookmarkCardAutoAlign = applyBookmarkCardAutoAlign;
window.syncBookmarkCardWidthsToContainer = syncBookmarkCardWidthsToContainer;

startBookmarkCardResize = function (event, card, options = {}) {
    if (!card || event.button !== 0) return;

    const categoryName = card.dataset.category;
    if (!categoryName) return;

    const resizeLeft = options.resizeLeft === true;
    const resizeRight = options.resizeRight === true || (!resizeLeft && options.resizeWidth !== false);
    const resizeTop = options.resizeTop === true;
    const resizeBottom = options.resizeBottom === true || (!resizeTop && options.resizeHeight === true);
    const resizeWidth = resizeLeft || resizeRight;
    const resizeHeight = resizeTop || resizeBottom;
    const cursor = options.cursor || ((resizeWidth && resizeHeight) ? 'nwse-resize' : (resizeWidth ? 'ew-resize' : 'ns-resize'));

    event.preventDefault();
    event.stopPropagation();

    const metrics = getBookmarkLayoutContainerMetrics();
    const startLayout = getBookmarkCardLayoutData(card, metrics);
    const startX = event.clientX;
    const startY = event.clientY;
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;

    let latestWidth = startLayout.width;
    let latestHeight = startLayout.height;
    let pendingX = startX;
    let pendingY = startY;
    let animationFrameId = null;
    const affectedCategories = new Set(categoryName ? [categoryName] : []);

    const scheduleRealtimeLayoutSave = () => {
        if (bookmarkLayoutRealtimeSaveTimer) {
            clearTimeout(bookmarkLayoutRealtimeSaveTimer);
        }
        bookmarkLayoutRealtimeSaveTimer = setTimeout(() => {
            bookmarkLayoutRealtimeSaveTimer = null;
            if (typeof window.saveLayoutState === 'function') {
                bookmarkLayoutRealtimeSavePromise = Promise.resolve(window.saveLayoutState())
                    .catch((error) => {
                        console.error('[书签布局] 实时保存失败:', error);
                    })
                    .finally(() => {
                        bookmarkLayoutRealtimeSavePromise = null;
                    });
            }
        }, 120);
    };

    document.body.classList.add('bookmark-card-resizing-active');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = cursor;
    card.classList.add('bookmark-card-resizing');
    card.classList.toggle('bookmark-card-resizing-width', resizeWidth && !resizeHeight);
    card.classList.toggle('bookmark-card-resizing-height', resizeHeight && !resizeWidth);

    const applyPendingResize = () => {
        animationFrameId = null;
        let nextLayout = { ...startLayout };

        if (resizeWidth) {
            const deltaX = snapBookmarkLayoutValue(pendingX - startX);
            if (resizeLeft) {
                const proposedX = Math.max(0, snapBookmarkLayoutValue(startLayout.x + deltaX));
                const preservedRight = startLayout.x + startLayout.width;
                nextLayout.x = proposedX;
                nextLayout.width = Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, snapBookmarkLayoutValue(preservedRight - proposedX));
            }
            if (resizeRight) {
                nextLayout.width = Math.max(BOOKMARK_LAYOUT_MIN_WIDTH, snapBookmarkLayoutValue(startLayout.width + deltaX));
            }
        }

        if (resizeHeight) {
            const deltaY = snapBookmarkLayoutValue(pendingY - startY);
            if (resizeTop) {
                const proposedY = Math.max(0, snapBookmarkLayoutValue(startLayout.y + deltaY));
                const preservedBottom = startLayout.y + startLayout.height;
                nextLayout.y = proposedY;
                nextLayout.height = Math.max(BOOKMARK_LAYOUT_MIN_HEIGHT, snapBookmarkLayoutValue(preservedBottom - proposedY));
            }
            if (resizeBottom) {
                nextLayout.height = Math.max(BOOKMARK_LAYOUT_MIN_HEIGHT, snapBookmarkLayoutValue(startLayout.height + deltaY));
            }
        }

        const resizeEdges = {
            left: resizeLeft,
            right: resizeRight,
            top: resizeTop,
            bottom: resizeBottom
        };
        const resolvedLayouts = resolveBookmarkLayoutsForResize(card, nextLayout, metrics, resizeEdges);

        if (resolvedLayouts) {
            applyResolvedBookmarkLayouts(resolvedLayouts);
            resolvedLayouts.forEach((_, resolvedCard) => {
                if (resolvedCard?.dataset?.category) {
                    affectedCategories.add(resolvedCard.dataset.category);
                }
            });
            nextLayout = resolvedLayouts.get(card) || nextLayout;
        } else {
            nextLayout = resolveBookmarkResizeLayout(card, nextLayout, metrics, resizeEdges);
            setBookmarkCardLayoutData(card, nextLayout);
        }

        latestWidth = nextLayout.width;
        latestHeight = nextLayout.height;
        layoutBookmarkCardsFreeform();
        scheduleRealtimeLayoutSave();
    };

    const queueResizeFrame = () => {
        if (animationFrameId !== null) return;
        animationFrameId = window.requestAnimationFrame(applyPendingResize);
    };

    const handleMouseMove = (moveEvent) => {
        moveEvent.preventDefault();
        pendingX = moveEvent.clientX;
        pendingY = moveEvent.clientY;
        queueResizeFrame();
    };

    const stopResize = async () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResize);
        if (animationFrameId !== null) {
            window.cancelAnimationFrame(animationFrameId);
            applyPendingResize();
        }
        document.body.classList.remove('bookmark-card-resizing-active');
        document.body.style.userSelect = originalUserSelect;
        document.body.style.cursor = originalCursor;
        card.classList.remove(
            'bookmark-card-resizing',
            'bookmark-card-resizing-width',
            'bookmark-card-resizing-height'
        );

        await Promise.all(
            Array.from(affectedCategories)
                .filter(Boolean)
                .map((affectedCategory) => saveBookmarkCardFreeLayout(affectedCategory))
        );
        if (bookmarkLayoutRealtimeSaveTimer) {
            clearTimeout(bookmarkLayoutRealtimeSaveTimer);
            bookmarkLayoutRealtimeSaveTimer = null;
        }
        if (bookmarkLayoutRealtimeSavePromise) {
            await bookmarkLayoutRealtimeSavePromise;
        }
        if (window.updateBookmarkScrollbars) {
            window.updateBookmarkScrollbars();
        }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
};

saveBookmarkCardSize = async function (categoryName, width, height) {
    const card = document.querySelector(`#bookmarks-container .bookmark-card[data-category="${CSS.escape(categoryName)}"]`);
    if (!card) return;

    if (width !== null && width !== undefined) {
        card.dataset.layoutWidth = String(clampBookmarkLayoutWidth(parseBookmarkLayoutNumber(width) || width, getBookmarkLayoutContainerMetrics()));
    }
    if (height !== null && height !== undefined) {
        card.dataset.layoutHeight = String(clampBookmarkLayoutHeight(parseBookmarkLayoutNumber(height) || height));
    }

    layoutBookmarkCardsFreeform();
    await saveBookmarkCardFreeLayout(categoryName);
};

window.flushBookmarkLayoutRealtimeSave = async function () {
    if (bookmarkLayoutRealtimeSaveTimer) {
        clearTimeout(bookmarkLayoutRealtimeSaveTimer);
        bookmarkLayoutRealtimeSaveTimer = null;
        if (typeof window.saveLayoutState === 'function') {
            bookmarkLayoutRealtimeSavePromise = Promise.resolve(window.saveLayoutState())
                .catch((error) => {
                    console.error('[书签布局] 关闭前保存失败:', error);
                })
                .finally(() => {
                    bookmarkLayoutRealtimeSavePromise = null;
                });
        }
    }

    if (bookmarkLayoutRealtimeSavePromise) {
        await bookmarkLayoutRealtimeSavePromise;
    }
};

window.addBookmarkCardResizeHandles = function (card) {
    if (window.clearBookmarkCardResizeHandles) {
        window.clearBookmarkCardResizeHandles();
    }

    if (!card ||
        !card.classList.contains('bookmark-card') ||
        !card.classList.contains('highlighted-card') ||
        card.classList.contains('bookmark-card-collapsed') ||
        !document.body.classList.contains('sidebar-open')) {
        return;
    }

    card.classList.add('bookmark-card-resizable');

    const createHandle = (className, title, resizeOptions) => {
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = className;
        handle.title = title;
        handle.setAttribute('aria-label', title);
        handle.addEventListener('mousedown', (event) => startBookmarkCardResize(event, card, resizeOptions));
        handle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        card.appendChild(handle);
    };

    createHandle('bookmark-resize-handle-left-edge', '拖动左侧边缘调整宽度', {
        resizeLeft: true,
        resizeWidth: true,
        resizeHeight: false,
        cursor: 'ew-resize'
    });
    createHandle('bookmark-resize-handle-right-edge', '拖动右侧边缘调整宽度', {
        resizeRight: true,
        resizeWidth: true,
        resizeHeight: false,
        cursor: 'ew-resize'
    });
    createHandle('bookmark-resize-handle-top-edge', '拖动上侧边缘调整高度', {
        resizeTop: true,
        resizeWidth: false,
        resizeHeight: true,
        cursor: 'ns-resize'
    });
    createHandle('bookmark-resize-handle-bottom-edge', '拖动下侧边缘调整高度', {
        resizeBottom: true,
        resizeWidth: false,
        resizeHeight: true,
        cursor: 'ns-resize'
    });
};

restoreBookmarkStyles = async function () {
    const config = await dataManager.getDashboardConfig();
    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    const cards = [...container.querySelectorAll('.bookmark-card')];
    const cardMap = new Map();

    cards.forEach(card => {
        const category = (card.dataset.category || '').trim();
        if (category) {
            cardMap.set(category, card);
        }

        card.style.width = '';
        card.style.height = '';
        card.style.left = '';
        card.style.top = '';
        card.style.order = '';
        card.style.gridRow = '';
        card.style.gridColumn = '';
        card.style.removeProperty('--bookmark-free-layout-width');
        delete card.dataset.layoutX;
        delete card.dataset.layoutY;
        delete card.dataset.layoutWidth;
        delete card.dataset.layoutHeight;
    });

    const layoutItems = Array.isArray(config?.bookmarkLayout) ? [...config.bookmarkLayout] : [];
    layoutItems.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));

    layoutItems.forEach(item => {
        const categoryName = (item.category || '').trim();
        const card = cardMap.get(categoryName);
        if (!card) return;

        card.className = `glass-card bookmark-card${item.collapsed ? ' bookmark-card-collapsed' : ''}`;
        card.style.display = item.hidden === true ? 'none' : '';

        if (item.width !== undefined && item.width !== null && item.width !== '') {
            card.dataset.layoutWidth = String(item.width);
        }
        if (item.height !== undefined && item.height !== null && item.height !== '') {
            card.dataset.layoutHeight = String(item.height);
        }
        if (item.x !== undefined && item.x !== null && item.x !== '') {
            card.dataset.layoutX = String(item.x);
        }
        if (item.y !== undefined && item.y !== null && item.y !== '') {
            card.dataset.layoutY = String(item.y);
        }

        const grid = card.querySelector('.bookmark-grid');
        if (grid) {
            if (item.collapsed) {
                grid.classList.add('bookmark-grid-collapsed');
                grid.style.display = 'none';
            } else {
                grid.classList.remove('bookmark-grid-collapsed');
                grid.style.display = 'grid';
            }
        }

        const color = item.color || card.dataset.customColor || '#8b5cf6';
        const opacity = item.opacity || card.dataset.customOpacity || '0.7';
        card.dataset.customColor = color;
        card.dataset.customOpacity = opacity;

        setTimeout(() => {
            if (window.applyCardGradient) {
                window.applyCardGradient(card, color, opacity);
            }
        }, 0);

        container.appendChild(card);
    });

    cards.forEach(card => {
        if (!layoutItems.some(item => (item.category || '').trim() === (card.dataset.category || '').trim())) {
            card.dataset.layoutWidth = String(getDefaultBookmarkLayoutWidth(getBookmarkLayoutContainerMetrics()));
            card.dataset.layoutHeight = String(clampBookmarkLayoutHeight(BOOKMARK_CARD_MIN_HEIGHT));
            container.appendChild(card);
        }
    });

    layoutBookmarkCardsFreeform();
    if (typeof window.renderRightNav === 'function') {
        setTimeout(() => window.renderRightNav(), 100);
    }
    setTimeout(() => {
        if (window.updateBookmarkScrollbars) {
            window.updateBookmarkScrollbars();
        }
    }, 150);
};

window.restoreBookmarkStyles = restoreBookmarkStyles;
window.updateBookmarkCardSize = function (categoryName, width, height) {
    return saveBookmarkCardSize(categoryName, width, height);
};

// Final free-layout overrides: keep resize handles available for all bookmark cards
// while the settings sidebar is open, regardless of highlight state.
(function applyFinalBookmarkFreeLayoutOverrides() {
    function clearBookmarkCardResizeHandlesFinal() {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((bookmarkCard) => {
            bookmarkCard.classList.remove(
                'bookmark-card-resizable',
                'bookmark-card-resizing',
                'bookmark-card-resizing-width',
                'bookmark-card-resizing-height'
            );
            bookmarkCard.querySelectorAll(
                '.bookmark-resize-handle-right-edge, .bookmark-resize-handle-left-edge, .bookmark-resize-handle-top-edge, .bookmark-resize-handle-bottom-edge'
            ).forEach((handle) => handle.remove());
        });
        document.body.classList.remove('bookmark-card-resizing-active');
    }

    function refreshBookmarkCardResizeHandlesFinal() {
        clearBookmarkCardResizeHandlesFinal();

        if (!document.body.classList.contains('sidebar-open')) {
            return;
        }

        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            ensureBookmarkCardResizeHandles(card);
        });
    }

    window.clearBookmarkCardResizeHandles = function () {
        clearBookmarkCardResizeHandlesFinal();

        if (document.body.classList.contains('sidebar-open')) {
            requestAnimationFrame(() => {
                refreshBookmarkCardResizeHandlesFinal();
            });
        }
    };

    window.addBookmarkCardResizeHandles = function (card) {
        if (!document.body.classList.contains('sidebar-open')) {
            return;
        }

        if (card) {
            ensureBookmarkCardResizeHandles(card);
            return;
        }

        refreshBookmarkCardResizeHandlesFinal();
    };

    window.enableBookmarkCardSort = function () {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            if (card.dataset.bookmarkFreeMoveBound === 'true') return;
            card.dataset.bookmarkFreeMoveBound = 'true';
            card.addEventListener('mousedown', handleBookmarkFreeDragStart);
        });

        refreshBookmarkCardResizeHandlesFinal();
    };

    window.disableBookmarkCardSort = function () {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            card.removeEventListener('mousedown', handleBookmarkFreeDragStart);
            delete card.dataset.bookmarkFreeMoveBound;
            card.classList.remove('bookmark-card-free-dragging', 'bookmark-card-swap-target');
        });

        cleanupBookmarkFreeDragState();
        clearBookmarkCardResizeHandlesFinal();
    };

    window.refreshBookmarkCardResizeHandles = refreshBookmarkCardResizeHandlesFinal;
})();

function ensureBookmarkCardResizeHandles(card) {
    if (!card ||
        !card.classList.contains('bookmark-card') ||
        card.classList.contains('bookmark-card-collapsed') ||
        !document.body.classList.contains('sidebar-open') ||
        window.getComputedStyle(card).display === 'none') {
        return;
    }

    card.classList.add('bookmark-card-resizable');

    const createHandle = (className, title, resizeOptions) => {
        if (card.querySelector(`.${className}`)) {
            return;
        }

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = className;
        handle.title = title;
        handle.setAttribute('aria-label', title);
        handle.addEventListener('mousedown', (event) => startBookmarkCardResize(event, card, resizeOptions));
        handle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        card.appendChild(handle);
    };

    createHandle('bookmark-resize-handle-left-edge', '拖动左侧边缘调整宽度', {
        resizeLeft: true,
        resizeWidth: true,
        resizeHeight: false,
        cursor: 'ew-resize'
    });
    createHandle('bookmark-resize-handle-right-edge', '拖动右侧边缘调整宽度', {
        resizeRight: true,
        resizeWidth: true,
        resizeHeight: false,
        cursor: 'ew-resize'
    });
    createHandle('bookmark-resize-handle-top-edge', '拖动上侧边缘调整高度', {
        resizeTop: true,
        resizeWidth: false,
        resizeHeight: true,
        cursor: 'ns-resize'
    });
    createHandle('bookmark-resize-handle-bottom-edge', '拖动下侧边缘调整高度', {
        resizeBottom: true,
        resizeWidth: false,
        resizeHeight: true,
        cursor: 'ns-resize'
    });
}

function refreshBookmarkCardResizeHandles() {
    if (window.clearBookmarkCardResizeHandles) {
        window.clearBookmarkCardResizeHandles();
    }

    if (!document.body.classList.contains('sidebar-open')) {
        return;
    }

    document.querySelectorAll('#bookmarks-container .bookmark-card').forEach(card => {
        ensureBookmarkCardResizeHandles(card);
    });
}

window.addBookmarkCardResizeHandles = function (card) {
    if (!document.body.classList.contains('sidebar-open')) {
        return;
    }

    if (card) {
        ensureBookmarkCardResizeHandles(card);
        return;
    }

    refreshBookmarkCardResizeHandles();
};

restoreBookmarkStyles = async function () {
    const config = await dataManager.getDashboardConfig();
    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    const cards = [...container.querySelectorAll('.bookmark-card')];
    const cardMap = new Map();

    cards.forEach(card => {
        const category = (card.dataset.category || '').trim();
        if (category) {
            cardMap.set(category, card);
        }

        card.className = 'glass-card bookmark-card';
        card.style.display = '';
        card.style.width = '';
        card.style.height = '';
        card.style.left = '';
        card.style.top = '';
        card.style.order = '';
        card.style.gridRow = '';
        card.style.gridColumn = '';
        delete card.dataset.layoutX;
        delete card.dataset.layoutY;
        delete card.dataset.layoutWidth;
        delete card.dataset.layoutHeight;

        const grid = card.querySelector('.bookmark-grid');
        if (grid) {
            grid.classList.remove('bookmark-grid-collapsed');
            grid.style.display = 'grid';
        }
    });

    const layoutItems = Array.isArray(config?.bookmarkLayout) ? [...config.bookmarkLayout] : [];
    layoutItems.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));

    layoutItems.forEach(item => {
        const categoryName = (item.category || '').trim();
        const card = cardMap.get(categoryName);
        if (!card) return;

        const isCollapsed = item?.collapsed === true;
        card.className = `glass-card bookmark-card${isCollapsed ? ' bookmark-card-collapsed' : ''}`;
        card.style.display = item.hidden === true ? 'none' : '';

        if (item.width !== undefined && item.width !== null && item.width !== '') {
            card.dataset.layoutWidth = String(item.width);
        }
        if (item.height !== undefined && item.height !== null && item.height !== '') {
            card.dataset.layoutHeight = String(item.height);
        }
        if (item.x !== undefined && item.x !== null && item.x !== '') {
            card.dataset.layoutX = String(item.x);
        }
        if (item.y !== undefined && item.y !== null && item.y !== '') {
            card.dataset.layoutY = String(item.y);
        }

        const grid = card.querySelector('.bookmark-grid');
        if (grid) {
            if (isCollapsed) {
                grid.classList.add('bookmark-grid-collapsed');
                grid.style.display = 'none';
            } else {
                grid.classList.remove('bookmark-grid-collapsed');
                grid.style.display = 'grid';
            }
        }

        const color = item.color || card.dataset.customColor || '#8b5cf6';
        const opacity = item.opacity || card.dataset.customOpacity || '0.7';
        card.dataset.customColor = color;
        card.dataset.customOpacity = opacity;

        setTimeout(() => {
            if (window.applyCardGradient) {
                window.applyCardGradient(card, color, opacity);
            }
        }, 0);

        container.appendChild(card);
    });

    cards.forEach(card => {
        if (!layoutItems.some(item => (item.category || '').trim() === (card.dataset.category || '').trim())) {
            card.dataset.layoutWidth = String(getDefaultBookmarkLayoutWidth(getBookmarkLayoutContainerMetrics()));
            card.dataset.layoutHeight = String(clampBookmarkLayoutHeight(BOOKMARK_CARD_MIN_HEIGHT));
            container.appendChild(card);
        }
    });

    layoutBookmarkCardsFreeform();
    if (typeof window.renderRightNav === 'function') {
        setTimeout(() => window.renderRightNav(), 100);
    }
    setTimeout(() => {
        if (window.updateBookmarkScrollbars) {
            window.updateBookmarkScrollbars();
        }
    }, 150);
};

window.restoreBookmarkStyles = restoreBookmarkStyles;
// Final free-layout overrides: keep resize handles available for all bookmark cards
// while the settings sidebar is open, regardless of highlight state.
(function applyFinalBookmarkFreeLayoutOverrides() {
    function clearBookmarkCardResizeHandlesFinal() {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((bookmarkCard) => {
            bookmarkCard.classList.remove(
                'bookmark-card-resizable',
                'bookmark-card-resizing',
                'bookmark-card-resizing-width',
                'bookmark-card-resizing-height'
            );
            bookmarkCard.querySelectorAll(
                '.bookmark-resize-handle-right-edge, .bookmark-resize-handle-left-edge, .bookmark-resize-handle-top-edge, .bookmark-resize-handle-bottom-edge'
            ).forEach((handle) => handle.remove());
        });
        document.body.classList.remove('bookmark-card-resizing-active');
    }

    function refreshBookmarkCardResizeHandlesFinal() {
        clearBookmarkCardResizeHandlesFinal();

        if (!document.body.classList.contains('sidebar-open')) {
            return;
        }

        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            ensureBookmarkCardResizeHandles(card);
        });
    }

    window.clearBookmarkCardResizeHandles = function () {
        clearBookmarkCardResizeHandlesFinal();

        if (document.body.classList.contains('sidebar-open')) {
            requestAnimationFrame(() => {
                refreshBookmarkCardResizeHandlesFinal();
            });
        }
    };

    window.addBookmarkCardResizeHandles = function (card) {
        if (!document.body.classList.contains('sidebar-open')) {
            return;
        }

        if (card) {
            ensureBookmarkCardResizeHandles(card);
            return;
        }

        refreshBookmarkCardResizeHandlesFinal();
    };

    window.enableBookmarkCardSort = function () {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            if (card.dataset.bookmarkFreeMoveBound === 'true') return;
            card.dataset.bookmarkFreeMoveBound = 'true';
            card.addEventListener('mousedown', handleBookmarkFreeDragStart);
        });

        refreshBookmarkCardResizeHandlesFinal();
    };

    window.disableBookmarkCardSort = function () {
        document.querySelectorAll('#bookmarks-container .bookmark-card').forEach((card) => {
            card.removeEventListener('mousedown', handleBookmarkFreeDragStart);
            delete card.dataset.bookmarkFreeMoveBound;
            card.classList.remove('bookmark-card-free-dragging', 'bookmark-card-swap-target');
        });

        cleanupBookmarkFreeDragState();
        clearBookmarkCardResizeHandlesFinal();
    };

    window.refreshBookmarkCardResizeHandles = refreshBookmarkCardResizeHandlesFinal;
})();

