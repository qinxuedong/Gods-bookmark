# God's Bookmark 项目研究报告与执行计划

> 生成日期：2026-08-17
> 研究范围：外网首屏加载卡顿根因分析、全项目代码审查（安全 / 功能 / 性能 / 架构）
> 关联版本：Web v2.0.1 / 扩展 v2.0.1

---

## 一、项目概况

- **架构**：Node.js + Express + SQLite 单文件后端（`server.js` 约 2775 行），原生 JS 前端无构建流程（`js/app.js` 353KB、`js/dashboard-layout.js` 223KB、`css/style.css` 99KB），外加 Chrome MV3 双向同步扩展
- **实际数据量**：user 1 共 12 个分类、266 个书签，bookmarks JSON 约 71KB
- 整体功能完成度高：多用户隔离、SSE 实时同步、CSP、favicon SSRF 防护均已实现

---

## 二、外网首屏卡顿根因（按影响排序）

### 1. Google Fonts 阻塞渲染（最高优先修复）

`index.html:11-13`、`login.html:9-10` 在 `<head>` 加载 `fonts.googleapis.com` 的 CSS，属于**渲染阻塞资源**。国内网络访问该域名经常不通，浏览器需等待超时后才首次渲染，表现即"卡一会儿后整页突然出现"。CSP（`server.js:2738-2740`）也写死了对它的依赖。

**修复方案**：删除两处外链与 preconnect；`style.css:14` 字体栈改为系统字体；同步收紧 CSP。

### 2. 首屏前的串行请求瀑布

`DOMContentLoaded` 后、书签渲染前需**串行**完成 6 个请求，渲染后还有 4 个，合计约 10 个串行往返：

| 顺序 | 请求 | 来源 |
|---|---|---|
| 1 | GET /api/config | initGlobalUI 取标题（app.js:391） |
| 2 | GET /api/users/check-auth | isLoggedIn（app.js:438） |
| 3 | GET /api/users/check-auth | userManager.checkAuth（app.js:444，重复请求） |
| 4 | GET /api/config | restoreTheme（dashboard-layout.js:3218，第 2 次） |
| 5 | GET /api/bookmarks | loadBookmarks（app.js:3588） |
| 6 | GET /api/config | loadBookmarks 取布局（app.js:3639，第 3 次） |
| 7 | GET /api/config | initMonitor（app.js:4418，第 4 次） |
| 8 | GET /api/bookmark/top | loadFrequentBookmarks |
| 9 | GET /api/users/check-auth | initDashboard（app.js:1189，第 3 次） |
| 10 | GET /api/bookmarks | initGlobalSearch → refreshBookmarksCache（app.js:6233，**二次全量拉取 71KB**） |

另：/api/todos、SSE 连接。内网 RTT≈1ms 无感；外网 RTT 50~200ms 时纯等待 0.5~2s。

**修复方案**：
- DataManager 增加 config 会话级缓存（保存后失效）
- getBookmarks 增加并发去重 + 短 TTL 缓存（保存 / SSE 变更时失效）
- userManager.checkAuth 增加缓存（login/logout 失效）
- initGlobalUI 中 config 与认证检查并行发起
- initDashboard 中 bookmarks / top / monitor / todos 并行加载

### 3. 无压缩 + 静态资源无缓存策略

`package.json` 无 `compression`，约 676KB JS/CSS 原样传输（gzip 后约 120~150KB）。家庭宽带上行 5~30Mbps，此项浪费 0.5~1s。

**修复方案**：引入 compression 中间件；静态目录 max-age 1 小时 + ETag；HTML no-cache（保证部署后立即生效）。

### 4. favicon 代理缓存不落盘 + 淘汰逻辑失效

- 内存缓存重启全失效，重启后 266 个书签的图标需重新抓取（单个最坏 3 段 × 1.5s 超时 ≈ 4.5s），排队慢慢出现
- `server.js:429-441` 淘汰逻辑只删已过期条目，全部未过期时一条不删，缓存可无限增长

**修复方案**：favicon 落盘到 `data/favicons/`（hash 文件名 + JSON 索引 + 写透）；LRU 改为按插入顺序淘汰。

### 5. 渲染端开销（次要，暂不处理）

- CSS 50 处 `backdrop-filter` + 黑洞 canvas 常驻动画（150 粒子 + 80 线）
- `initDatetimeScrollEffect` 的 MutationObserver 在初始渲染 266 项时反复全卡片测量

---

## 三、安全问题

### 1.【高危】项目根目录被静态服务整体暴露

`server.js:2751`：`app.use(express.static(path.join(__dirname, '/')))`。无需登录即可下载：

- `/data/database.sqlite` —— **整个数据库**（密码哈希、session、全部书签）
- `/server.js`、`/check-users.js`、`/package.json`、`/node_modules/**`、`/extension.zip` 等
- `.env`、`.git/` 仅因 Express 默认忽略点文件而幸免

**修复方案**：白名单暴露——仅 `/`、`/index.html`、`/login.html`、`/favicon.ico`、`/js/*`、`/css/*`、`/Contro256.png`、`/extension/icon16.png`、`/BACKUP_CRON_GUIDE.md`（页面内有链接）。

### 2.【中】日志泄露敏感信息

- `server.js:685` 登录失败时打印密码哈希前 20 位
- `requireAuth`（server.js:255-256 等）每个请求打印路径与 session id

**修复方案**：删除哈希日志；requireAuth 仅保留错误日志。

### 3.【中】HTTPS 与 Cookie（本次不改代码，部署建议）

`secure: isProduction` 依赖 `NODE_ENV=production`；纯 HTTP 外网访问时 session cookie 明文传输。建议在 README 已有提示基础上，部署侧启用 HTTPS 反代（顺带获得 HTTP/2 多路复用，缓解 SSE 占用连接问题）。

---

## 四、功能性 Bug

1. **系统监控是假数据**：`updateMonitorData`（app.js:4464-4472）CPU/RAM 用 `Math.random()`，磁盘写死 78%
   **修复**：服务端新增 `/api/system`（os 模块 CPU 采样 + 内存 + `fs.statfs` 磁盘），前端轮询真实数据
2. **农历是假算法**：`datetime-weather.js:59-72` 用糊弄公式，显示基本错误
   **修复**：替换为标准 1900-2100 农历数据表算法（含闰月）
3. **favicon 缓存淘汰失效**：见二.4

---

## 五、架构建议（长期，本次不执行）

- app.js / dashboard-layout.js 模块化拆分 + 打包压缩
- 扩展 content script 注入范围收窄
- 登录失败增加速率限制

---

## 六、执行计划

| # | 优先级 | 任务 | 状态 |
|---|---|---|---|
| 1 | P0 | 收敛静态服务暴露范围（白名单路由，杜绝数据库下载） | ✅ 已完成 |
| 2 | P0 | 移除 Google Fonts（index.html / login.html / CSP / 字体栈） | ✅ 已完成 |
| 3 | P0 | 删除密码哈希日志、降低 requireAuth 日志噪音 | ✅ 已完成 |
| 4 | P1 | 引入 compression + 静态缓存头 | ✅ 已完成 |
| 5 | P1 | 前端请求并行化与缓存（config 缓存 / auth 缓存 / bookmarks 去重 / init 并行） | ✅ 已完成 |
| 6 | P2 | favicon 磁盘持久化 + LRU 修复 + .gitignore | ✅ 已完成 |
| 7 | P2 | 真实系统监控（/api/system + 前端轮询） | ✅ 已完成 |
| 8 | P2 | 真实农历算法 | ✅ 已完成 |
| 9 | P3 | 模块化拆分、扩展权限收窄（长期，另行安排） | 不在本次范围 |

### 执行结果（2026-08-17 验证）

**改动文件**：server.js、index.html、login.html、css/style.css、js/app.js、js/data-manager.js、js/user-manager.js、js/datetime-weather.js、package.json（新增 compression）、.gitignore（忽略 data/favicons/）

**安全验证（curl 实测）**：
- `/data/database.sqlite`、`/server.js`、`/.env`、`/package.json`、`/check-users.js`、`/extension.zip`、`/node_modules/**` → 全部 **404**
- 白名单路由（/、index.html、login.html、js、css、图标、指南文档）→ 全部 200

**性能验证（curl 实测）**：
- gzip 生效：app.js 354KB → **71KB（-80%）**；bookmarks JSON 71KB → **13.6KB**
- HTML 响应 `Cache-Control: no-cache`（部署即生效），JS/CSS `max-age=3600` + ETag
- 首屏请求链：从约 10 个串行请求 + 二次书签全量拉取，收敛为 **config / check-auth / bookmarks / top / todos 并行各一次**
- favicon 重启回读：磁盘缓存命中 **5ms**（原先需网络重抓 1.5~4.5s）
- CSP 已移除 fonts.googleapis.com 依赖

**功能验证**：
- `/api/system`（需登录）：返回真实 CPU 13%、RAM 41%、磁盘 51%（os 模块 + statfs），不支持磁盘统计的环境显示 N/A
- 农历算法对照 11 个已知日期（含 2023 闰二月、2025 闰六月、2026-08-17=七月初五）全部通过
- 测试用临时 session 已从数据库清除

**遗留事项**：
- 部署侧建议尽快启用 HTTPS 反代（HTTP/2 可顺带解决 SSE 长连接挤占 HTTP/1.1 并发的问题）
- 浏览器强刷一次（Ctrl+F5）以使旧缓存的前端资源失效

---

## 七、第二轮首屏优化（2026-08-17 晚间追加）

第二轮针对"外网首屏卡顿"继续按推荐顺序处理。**声明：本轮未进行浏览器端 Performance 实测，以下效果判断基于代码链路证据与请求计数，非真实计时数据。**

### 7.1 已实施改动

| # | 改动 | 文件 | 说明 |
|---|---|---|---|
| 1 | 首屏初始化与 UI 权限初始化解耦 | `js/app.js` | `DOMContentLoaded` 中 `initDashboard()` 与 `initGlobalUI()` 并行启动（原先串行等待），书签/主题/常用栏立即开始加载 |
| 2 | loadBookmarks 认证门 | `js/app.js` | 未登录时不请求书签/统计接口、清空容器（保持私有数据不外泄）；`finally` 中的搜索缓存刷新与查重调度仅登录后执行 |
| 3 | 登录门控非公开模块 | `js/app.js` | 未登录时跳过 `initGlobalSearch`、待办加载、SSE 连接、监控轮询——此前未登录也会产生 401 请求噪音 |
| 4 | 监控轮询守卫 | `js/app.js` | **发现当前 HTML 中不存在 `#cpu-gauge` 等仪表元素**，`initMonitor` 的 5 秒 `/api/system` 轮询是纯开销；现无仪表元素或未登录时直接跳过 |
| 5 | loadFrequentBookmarks 顺序调整 | `js/app.js` | 先查登录态再请求 Top10，未登录不发请求 |
| 6 | 认证请求单飞 | `js/user-manager.js`、`js/data-manager.js` | `checkAuth` 并发去重；`isLoggedIn` 复用 `UserManager` 的在途请求，首屏认证请求最多 1 次 |
| 7 | 配置请求单飞 | `js/data-manager.js` | `getDashboardConfig` 并发去重（缓存已存在，补充并发场景） |
| 8 | favicon 懒加载 | `js/app.js` | 书签图标 `<img>` 增加 `loading="lazy"` + `decoding="async"`，视口外不发起请求 |
| 9 | 搜索配置后台加载 | `js/app.js` | `initGlobalSearch` 不再阻塞等待搜索配置 |
| 10 | 黑洞动画让路 | `js/blackhole.js` | 初始化与动画启动延迟到 `requestIdleCallback` 空闲时段；页面隐藏暂停；`prefers-reduced-motion` 用户不启动 |
| 11 | 首屏骨架与渲染优化 | `index.html`、`css/style.css` | 书签容器初始显示"正在加载书签…"占位；容器加 `content-visibility: auto` 减少视口外布局开销 |
| 12 | dashboard-layout 启动任务延后 | `js/dashboard-layout.js` | `restoreLayout`（仅监控卡片布局，当前页面无仪表实为空操作）与模态框按钮绑定延后到空闲时段执行 |

### 7.2 自动化回归测试（新增）

新增 `test/startup.test.mjs`（node:test + vm 沙箱 + mock fetch，不触网络/数据库/真实会话），`npm test` 运行：

1. `getDashboardConfig`：并发去重、会话缓存、保存后同步更新（GET 恰 1 次）
2. `getBookmarks`：并发去重共享同一结果、TTL 内不重拉、手动/保存后失效（GET 恰 3 次、POST 恰 1 次）
3. 认证单飞：`checkAuth` 并发仅 1 次请求；`isLoggedIn` 复用 `UserManager`；登出后缓存失效
4. `loadBookmarks` 认证门：未登录不发任何私有数据请求且容器清空
5. `loadBookmarks` 登录渲染：书签恰好拉取 1 次、分类与书签名正确渲染
6. 农历算法：11 个已知日期对照（含闰二月/闰六月/边界 1900-01-31）

**结果：6/6 通过。** 测试中发现并修正了三处测试自身的桩缺陷（容器桩未记忆化、fetch 日志未区分方法、`escapeHtml` 依赖的 DOM 转义未模拟），产品代码未因此改动。

### 7.3 服务器冒烟验证（第二轮后复测）

- 首页含加载占位符；js/css 全部 200；app.js gzip 后 71.5KB
- `/data/database.sqlite`、`/server.js`、`/package.json` 仍为 404
- `/api/system`、`/api/bookmarks` 未登录 401；`/api/favicon` 正常返回图标

### 7.4 刻意未做与理由

- **dashboard-layout.js 文件级拆分**：该文件 224KB，启动执行已确认极轻（顶层仅状态声明与 window 导出，DOMContentLoaded 工作已延后），剩余成本是解析。但拆分涉及约 300 个 window 导出与跨文件引用，在无浏览器可视化验证条件下整体延迟或拆分风险（主题/布局/控制中心回归）大于收益（预计数十毫秒解析时间）。已列入后续建议，建议在浏览器 Performance 面板确认解析确为瓶颈后再实施。
- **减少 backdrop-filter**：50 处使用散布在视觉样式中，盲改有视觉回归风险，未经浏览器验证不动。

### 7.5 对第一轮结论的修正

- 第一轮报告"首屏请求链收敛为 config / check-auth / bookmarks / top / todos 并行各一次"表述不完整：当时 check-auth 与 config 的**并发去重**尚未实现（仅缓存），第二轮补充后才严格成立；且 top/todos 依赖登录态判断，未登录时不再发出。
- 第一轮加回的真实监控轮询（5 秒 `/api/system`）在当前 HTML 无仪表元素的前提下属于无意义开销，第二轮已修正——仪表 UI 缺失本身是一个独立的历史遗留问题（组件被移除但 JS 保留）。

