# Release Notes v2.0.3

Release date: `2026-08-17`

## Changes

### 首屏加载优化（第二轮）

- 仪表盘数据加载与 UI 权限初始化解耦并行启动，不再等待控制中心就绪
- 认证与配置请求单飞（并发去重），首屏认证请求严格 1 次
- 书签渲染增加认证门：未登录不请求私有数据、清空容器，避免默认书签闪现
- 未登录时跳过搜索、待办、SSE 实时同步与监控轮询，消除 401 请求噪音
- 修复：监控轮询在页面不存在仪表元素时仍每 5 秒请求 `/api/system` 的问题（当前页面无仪表 UI）
- 书签 favicon 懒加载（`loading="lazy"` + `decoding="async"`），视口外图标不发起请求
- 黑洞动画延迟到空闲时段启动；页面隐藏时暂停；尊重 `prefers-reduced-motion`
- 书签容器增加"正在加载书签…"骨架占位与 `content-visibility` 渲染优化
- dashboard-layout 启动任务延后到空闲时段执行

### 工程化

- 新增自动化回归测试 `test/startup.test.mjs`（node:test + vm 沙箱 + mock fetch），`npm test` 运行，6/6 通过
  - 覆盖：配置/书签缓存与并发去重、认证单飞、书签认证门与登录渲染、农历算法已知日期对照
- `RESEARCH_REPORT_2026-08-17.md` 新增第七节：第二轮首屏优化记录（含对第一轮结论的修正与未实测项声明）
- `.mimosa/` 加入 `.gitignore`

## Affected Files

- `js/app.js`、`js/data-manager.js`、`js/user-manager.js`、`js/blackhole.js`、`js/dashboard-layout.js`
- `index.html`、`css/style.css`
- `package.json`、`package-lock.json`、`.gitignore`、`README.md`
- `test/startup.test.mjs`（新增）、`RESEARCH_REPORT_2026-08-17.md`

## Notes

- Web app version: `2.0.3`
- Browser extension version: `2.0.1`（本次未改动扩展）
- 部署后请强制刷新一次（Ctrl+F5），让浏览器丢弃旧缓存的前端资源
- 首屏性能效果基于代码链路与请求计数验证，浏览器端 Performance 实测待后续进行
