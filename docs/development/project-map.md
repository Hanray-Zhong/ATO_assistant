# ATO Assistant 二次开发导读

本次阅读基于 `b74fefd`（上游 v3.7.0，2026-10-13 的 checkout）。
本文是一份源码导航与当前实现说明，后续改动相关模块时同步维护。

## 上游与当前状态

| 项目 | 本次阅读结果 |
| --- | --- |
| 二次开发仓库 | `origin` → `Hanray-Zhong/ATO_assistant` |
| 上游 | `banard` → `banard2049-cpu/ATO_assistant` |
| 分支 | `main`，当前跟踪 `banard/main` |
| 程序版本 | `assets/update/app-version.js` 为 `3.7.0` |
| 构建形态 | 原生浏览器脚本与 PHP；无 npm 工程、根级 Makefile 或 JS 锁文件 |
| 辅助工具 | 独立 Python Asset Studio、Node TTS 工具、Python/PowerShell 打包脚本 |

分支跟踪关系是快照，不是永久约定；Git 操作前检查实际配置。
当前 clone 的 `banard` 拉取地址保持上游地址，push URL 设置为 `/dev/null`，
因此通过该 remote 的推送会在本地失败。`origin` 的推送地址仍指向自己的 fork。
该防误推配置只保存在当前 clone，不随 Git 提交传播；新 clone 可执行：

    git remote set-url --push banard /dev/null

技能任务默认记录在 fork 的 GitHub Issues，详见
[Issue tracker](../agents/issue-tracker.md)。

## 功能与代码入口

| 功能 | 主要入口与职责 |
| --- | --- |
| 战役主控台 | `index.html`：登录、档案/循环/日期、探索卡、全战役导入导出、模块导航 |
| 探索结算 | `assets/exploration-card-*.js`：规则、资源、条件、选项、持续/延迟效果；主控台负责交互与保存 |
| AI/BP 战斗 | `aibp/index.html`：牌堆、使徒面板、特性、结算；`card-images.js` 处理卡图；`battle_los.js` 与 `battle_map_control.js` 处理战斗版图 |
| 世界地图 | `map/index.html`、`map/app.js`、`map/map-data.js`、`map/nemesis-path.js`、`map/nemesis-battle.js` |
| 阿尔戈号记录 | `record/index.html`：循环数值、资源、泰坦、笔记；`note-attachments.js` 与 `assets/record-attachments.js` 处理附件 |
| 英雄 | `hero/index.html` 与 `hero/hero.css`：英雄记录和导出 |
| 科技与装备 | `technology/index.html`、`tech-tree.js`、`tech-page-layout.js`、`gear-inventory.js`，数据字典/图片映射为同目录 JSON |
| 故事 | `story/index.html`、`story/assets/app.js`；正文来自可选本地资料，`storybook-placeholder.js` 提供公开占位 |
| 密语与混合媒体 | `story/assets/cryptic*`、`centimanes*`、`mixed-media/renderer.js`，字形/图片/映射材料走资料包 |
| 第二屏 | `ss/index.html`、`ss/app.js`、`ss/terrain-data.js`：地图、战斗和故事快照展示 |
| 战役简报 | `briefing/api.php` 与 `briefing-*.js`：每日备份差分、地图/科技回放、浏览器 GIF/PDF 导出 |
| 共享显示与导航 | `assets/theme.js`、`term-language.js`、`english-*.js`、`cycle-symbols.js`、`page-focus-router.js` |
| 存档与账号 | `api/campaign-state.php`；页面账号守卫为 `assets/campaign-session.js` |
| 标签/字典辅助接口 | `api/map-tile-tags.php`、`exploration-card-tags.php`、`tech-card-dictionary.php`、`gear-parts.php` 等 |
| 素材库 | `asset-studio/app/`、`static/`、`tests/`：FastAPI、SQLite、内容去重、.atopack、安装与回滚 |
| 发布与导出 | `tools/export_portable.py`、`tools/export_android.py`、`tools/packaging/`、`tools/release_*.ps1` 与 `.github/workflows/` |

路径表中的省略文件名相对于该行对应功能目录。不要以目录名字判断整个目录都是素材；
例如 `aibp/ps/` 内既有用户卡图，也有受 Git 跟踪的运行时 JS/JSON。

## 页面、状态与数据流

1. HTML 直接按顺序加载普通脚本。共享库多使用 IIFE/UMD，
   通过 `window.ATO_*` 提供浏览器接口，部分同时暴露 CommonJS 供 Node 测试。
2. 页面通过 `api/campaign-state.php?section=<name>` 读取/保存自己的 section。
   顶层存档包含 `version`、`updatedAt`、`sections` 与 `sectionRevisions`。
3. 账号决定存档文件；战役 profile 在该账号内区分档案；循环承载该档案不同阶段状态。
   各页面有自己的 profile/cycle 结构，不应统一猜成一种 schema。
4. 写入携带版本号与账号身份；冲突后读最新状态并合并。主控台还用跨窗口广播/
   写入协调机制；浏览器本地偏好不能替代服务端存档。
5. 第二屏经 token 获取筛选后的快照；跨设备主题也经服务端传递。
   Android 开启第二屏时由本机 HTTP 服务提供局域网访问，账号操作有独立限制。
6. 每日备份是简报历史来源；它报告相邻快照的净变化，不是完整事件日志。
7. 记录表的装备库存等字段会被科技页读写；探索结算、战斗掉落等也跨页面影响记录。
   修改一个页面前先确认对应 section 的全部消费者。

## 运行与存储

- 桌面源码启动器为 `start-macos.command` / `start-windows.bat`；
  PHP 正常入口是 `router.php`，默认端口 8793。Apache 的相应规则在 `.htaccess`。
- `data/` 保存账号、会话、战役、每日/近期备份及记录附件，不进入 Git；
  诊断使用 `ATO_DATA_DIR` 指向隔离数据，不能用真实存档做夹具。
- 源码根级 `docker-compose.yml` 提供本地源码挂载方案，端口映射与发布包
  `tools/packaging/docker/compose*.yaml` 不同；根据实际使用配置阅读。
- Android 使用 Java WebView 壳，不运行 PHP。导出器接入
  `tools/packaging/android/fetch-bridge.js`，将部分 fetch 转接至
  `MainActivity.java` / `LocalCampaignApi.java`；`LocalSecondScreenServer.java`
  提供局域网服务，`AtopackStore.java` 处理资源包。
- Android 模板位于 `tools/packaging/android/`；固定 Gradle/SDK 版本及下载缓存
  由导出器管理，当前没有仓库 Gradle wrapper。
- Asset Studio 启动器/README 使用自己的 `.venv`，默认端口 8765；
  配置位于其 `.local/`，素材和 SQLite 位于用户选择的资料库。
- Node TTS 辅助工具位于 `tools/tts-toolkit/`，与主站分开运行；
  实际语音生成涉及外部服务与本地凭据，应按单独任务授权使用。

## 二次开发需要关注的边界

**存档兼容。** PHP 与 Android Java 是同一前端协议的两份实现。
新增字段/接口既要检查规范化与冲突重试，也要检查旧 JSON/.jsave 导入、
备份恢复、附件和第二屏。相关检查入口见开发验证文档。

**程序与资料包。** 仓库只公开程序与占位数据，`.atopack` 是独立资源通道。
`.gitignore` 控制跟踪，`package_common.py` 控制导出，
`app-update-policy.php` 控制在线更新；三者作用不同，不能只改其中一个就假定全部生效。

**历史大文件。** 当前主控台约 11,605 行，AIBP 页面约 9,214 行，
记录页约 6,586 行。测试常通过 VM 提取内联函数。新增功能宜先确定职责与接入点，
再抽取可独立验证的模块；不把初始化变成全站重构。

**可选私有数据。** 故事正文、mixed-media mapping、图像和音频可缺失。
页面与测试应区分公开代码回归和本地素材一致性；不能把一台开发机的资料作为公共 CI 前提。

**Fork 发布来源。** 以下文件仍含上游仓库地址：
`assets/update/update-check.js`、`tools/install-docker.sh`、
`tools/packaging/docker/compose*.yaml`、`.github/workflows/docker-package.yml`、
`README.md` / `README.en.md`。发布定制版时需统一决定更新来源、镜像命名、
应用身份与 Android 签名；本次记录现状，尚未形成发布方案。

## 下一次功能任务的阅读顺序

先从需求对应页面定位入口，再读它引用的共享库、API/存档字段与调用方；
修改资源路径时加入素材库和导出器；最后选择相关回归。
领域术语与已接受决策按 [Domain Docs](../agents/domain.md) 消费。
