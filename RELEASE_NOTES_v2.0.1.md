# Release Notes v2.0.2

Release date: `2026-08-17`

## Changes

### 性能（外网首屏加载）

- 移除渲染阻塞的 Google Fonts 外链，改用系统字体栈，并同步收紧 CSP
- 新增 gzip 压缩与静态缓存头（app.js 354KB → 71KB，书签 JSON 71KB → 13.6KB）
- 首屏 API 请求并行化：config/auth 会话级缓存 + 书签请求去重（约 10 个串行往返 → 5 个并行请求）
- favicon 缓存落盘（`data/favicons/`）并修复 LRU 淘汰逻辑，服务重启后图标无需重新抓取（约 5ms 命中，原先需 1.5~4.5s）

### 安全

- 静态服务改为白名单路由，`data/database.sqlite`、`server.js`、`.env`、`node_modules/` 等不再可被未认证下载
- 删除登录日志中的密码哈希输出与每个请求的认证日志噪音

### 修复

- 系统监控部件展示真实 CPU/内存/磁盘数据（新增 `/api/system` 端点，原先为随机假数据）
- 农历改用标准 1900-2100 历法算法并支持闰月（原先为近似公式）

## Affected Files

- `server.js`
- `index.html`、`login.html`、`css/style.css`
- `js/app.js`、`js/data-manager.js`、`js/user-manager.js`、`js/datetime-weather.js`
- `package.json`、`package-lock.json`、`.gitignore`、`README.md`

## Notes

- Web app version: `2.0.2`
- Browser extension version: `2.0.1`（本次未改动扩展）
- 部署后请强制刷新一次（Ctrl+F5），让浏览器丢弃旧缓存的前端资源
- 完整研究报告见 `RESEARCH_REPORT_2026-08-17.md`
