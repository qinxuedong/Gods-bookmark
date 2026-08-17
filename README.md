# God's Bookmark

![God's Bookmark](docs/images/godbook.png)

一个可自托管的书签仪表盘，支持浏览器扩展双向同步、跨页面快捷搜索、布局编辑、点击统计、待办事项和自动备份。

> 重要提醒：部署或批量同步前，请先导出浏览器原始书签做好备份。

## 当前版本

- Web 应用：`2.0.2`
- 浏览器扩展：`2.0.1`

## 核心能力

- 浏览器书签与网站双向同步，支持新增、删除、移动和文件夹同步
- 两台设备同时在线时，网站可接收实时同步广播
- `Ctrl+Space` 可在书签首页和普通网页中直接调出搜索浮层
- 网站与扩展统一通过 `/api/favicon` 获取图标，适合远程部署
- 全局设置支持书签模块尺寸调整、拖拽排序和自动保存
- 控制中心支持手动执行“合并书签”
- 支持本地或 NAS 自动备份

## 快速开始

### Node.js

1. 安装依赖

```bash
npm install
```

2. 启动服务

```bash
npm start
```

3. 打开 `http://localhost:3000`

首次启动会自动创建默认管理员账号：

- 用户名：`admin`
- 密码：`admin`

生产环境请通过环境变量 `ADMIN_PASSWORD` 设置强密码，并在首次登录后立即修改。

### Docker

```bash
docker-compose up -d
```

更多部署细节见 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)。

## 浏览器扩展

扩展目录位于 [extension/README.md](extension/README.md)，当前版本 `2.0.1`。

主要能力：

- 浏览器书签与网站双向同步
- `Ctrl+Space` 全局搜索
- 远程部署场景下统一的 favicon 加载
- 弹窗配置服务器地址、同步开关和手动全量同步

### 本地安装

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择 `extension` 目录

详细安装步骤见 [extension/安装说明.md](extension/安装说明.md)。

## 合并书签

当前版本已将自动查重改为手动工具。

- 入口：控制中心 -> `合并书签`
- 规则：仅当“书签名称 + URL”同时相同，才会被合并
- 行为：保留首次出现的位置，并同步清理浏览器侧重复项

## 打包发布扩展

运行：

```bash
npm run build-extension
```

生成文件：

- `extension.zip`

打包脚本会检查：

- `manifest.json` 必填字段
- manifest 引用的脚本和图标
- 发布包所需文件是否完整

发布前检查清单见 [EXTENSION_CHECK_REPORT.md](EXTENSION_CHECK_REPORT.md)。

## 文档索引

- [API.md](API.md)
- [DATA_MODEL.md](DATA_MODEL.md)
- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- [BACKUP_CRON_GUIDE.md](BACKUP_CRON_GUIDE.md)
- [EXTENSION_CHECK_REPORT.md](EXTENSION_CHECK_REPORT.md)
- [RELEASE_NOTES_v2.0.1.md](RELEASE_NOTES_v2.0.1.md)
- [RELEASE_NOTES_v2.0.0.md](RELEASE_NOTES_v2.0.0.md)
- [RELEASE_NOTES_v1.1.2.md](RELEASE_NOTES_v1.1.2.md)
- [RELEASE_NOTES_v1.1.1.md](RELEASE_NOTES_v1.1.1.md)
- [RELEASE_NOTES_v1.1.0.md](RELEASE_NOTES_v1.1.0.md)
- [extension/README.md](extension/README.md)
- [extension/安装说明.md](extension/安装说明.md)
- [extension/故障排查.md](extension/故障排查.md)

## 安全建议

- 生产环境务必启用 HTTPS
- 修改默认管理员密码，避免使用 `admin/admin`
- 为 `data` 和 `backups` 目录配置持久化与备份
- 仅在可信网络环境中开放服务端口

## 许可证

MIT
