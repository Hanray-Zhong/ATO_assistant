# ATO Assistant 协作指南

本仓库用于在上游 ATO Assistant 基础上进行二次开发。开始任务时，先阅读
`README.md`、本文及任务涉及模块的源码；目录与验证入口见
[项目导读](docs/development/project-map.md) 和
[开发验证](docs/development/validation.md)。
本文补充个人级协作规则；用户当前指令及更具体的目录规则优先。

## 项目与开发入口

- 主站是直接加载的 HTML、CSS、JavaScript 与 PHP 接口，没有 `package.json`、
  npm 构建步骤或统一测试脚本。使用现有 Node/Python 检查，不引入工具链迁移。
- 主控台入口为 `index.html`；战斗、地图、记录、英雄、故事、科技、第二屏和简报
  分别位于 `aibp/`、`map/`、`record/`、`hero/`、`story/`、
  `technology/`、`ss/`、`briefing/`。
- `asset-studio/` 是独立 FastAPI + SQLite 素材工具，不是主站后端。
  修改它之前阅读其 `README.md`、`requirements.txt` 和 `app/`。
- CI 使用 Node.js 22、Python 3.12、JDK 17；素材工具声明 Python 3.11+，
  主站启动器检查 PHP 8.1+。实际发布运行时由 `tools/export_portable.py`
  与 `tools/packaging/docker/Dockerfile` 决定。
- 复用项目已有虚拟环境及打包器固定的工具版本；具体命令与依赖条件见开发验证文档。

## Fork 与 GitHub 操作

- 二次开发仓库：`Hanray-Zhong/ATO_assistant`，对应 `origin`。
- 上游仓库：`banard2049-cpu/ATO_assistant`，对应 `banard`。
- `banard` 仅用于 fetch/pull，禁止向上游 push；不得通过直连上游 URL、
  新建 remote 或修改 push URL 绕过限制。当前本地 push URL 为 `/dev/null`，
  用于阻止误推；新 clone 需重新设置这项本地配置。
- 执行 GitHub 命令时显式指定 `--repo Hanray-Zhong/ATO_assistant`。
  不根据当前分支的 tracking remote 推断任务目标；先读取实际 Git 配置。
- 修改前后检查 `git status --short` 与相关 diff，保留已有改动。
  提交、push、PR、tag、GitHub Issue 写入和发布均遵循当前任务的明确授权。
- 若任务授权创建分支，默认使用 `codex/` 前缀；若授权提交，提交信息使用
  Conventional Commits 与中文描述，例如 `docs: 初始化二次开发协作约定`。
- 定制版发布前核对应用内更新、Docker 镜像、安装脚本及 README 的来源地址；
  当前上游地址清单见项目导读。避免定制安装被上游更新覆盖。

## 代码组织与浏览器运行约定

- 新功能放入对应业务目录；只有跨页面共享功能放入 `assets/` 的职责明确目录。
  包根只保留必要入口、配置、注册与兼容文件。
- 新增手工维护源码文件不得超过 500 个物理行；测试、生成代码、第三方代码、
  数据库迁移和快照除外。已有大文件的扩展应按职责抽取模块，避免继续堆叠独立逻辑。
  不为本次任务以外的历史代码做无关拆分。
- 保持附近代码的语言、缩进、换行和 IIFE/UMD 风格。普通浏览器脚本由
  `<script>` 加载并通过 `window.ATO_*` 等对象共享；不得直接把 CommonJS/ESM
  用法放入现有普通 script 入口。
- 修改脚本接入时同时检查依赖顺序、页面相对路径、所有消费者和已有缓存参数。
  主站必须可从子目录运行，并兼容 Android 的 `file:///android_asset/web/`。
- 许多测试从 HTML 中提取函数或常量声明。移动代码、改变声明形式时同步调整相关
  harness，保留验证真实行为的断言。
- 自动生成规则与数据先确认生成脚本及来源。不要把本地 OCR、完整故事或提取的图片
  当作可提交源码，也不要凭文件名中的哈希擅自重命名 AIBP 文件。

## 存档与跨平台契约

- 主站存档入口为 `api/campaign-state.php`；Android 通过
  `tools/packaging/android/fetch-bridge.js` 转接到 `LocalCampaignApi.java`。
  改接口、状态字段、导入导出或备份时检查 PHP 与 Java 两端及各页面读写者。
- 现有 section 为 `dashboard`、`map`、`record`、`technology`、
  `heroes`、`aibp`、`story`。保持旧存档规范化、profile/cycle 分桶、
  未知兼容字段及账号隔离；账号与战役 profile 不是同一概念。
- 保留 `expectedRevision` / `sectionRevisions` 的冲突检测以及
  `expectedAccountId` 的账号检查。重试需读取最新状态并合并；账号切换后停止
  保存，不能把旧页面状态写入另一账号。
- 全战役导入使用现有 `import-sections` 原子入口；恢复历史存档时不能回退版本计数。
  保留文件锁、原子替换、备份和附件引用语义。
- `ss/` 读取经 token 授权的第二屏快照。战斗视线、地图与故事快照的变更需要核对
  主页面和第二屏；Android 局域网服务另有账号操作限制。
- `briefing/` 从每日备份推导净变化；新增回放字段时同时核对备份生成、
  PHP 简报与 Android 简报数据，不把未记录的历史补写成事实。
- 接口和诊断测试使用合成数据或 `ATO_DATA_DIR` 隔离的临时目录。
  不读取、改写或删除实际 `data/`、用户素材库和签名/TTS 凭据。

## 程序与资源边界

- 遵循 `LICENSE`、`.gitignore` 与 `tools/audit-public-release.ps1`。
  当前源码许可证声明为 `PolyForm-Noncommercial-1.0.0`，保留上游 Required Notice。
- 图片、音频、完整故事、个人存档、`.atopack` 与本地提取资料走用户资源通道，
  不随源码和程序包提交；既有明确白名单例外以仓库配置为准。
- 新增 `assets/` 程序文件需检查 Git 忽略例外和公开发布审计白名单，
  并核对页面引用的代码能从干净 checkout 获得。
- 程序打包排除规则在 `tools/packaging/package_common.py`，在线更新排除规则在
  `api/app-update-policy.php`；改边界时同步核对并运行对应回归。
- 改资源目标路径或清单时核对素材库、Android 导入名单、Docker 挂载与更新逻辑，
  保留路径校验、manifest/hash 校验、安装回滚和兼容旧资料包的行为。

## 验证与交付

- 从最小相关现有检查开始。行为变更新增/更新有意义的回归用例；文档变更检查链接、
  格式、路径及配置一致性，不编写仅复述文档内容的测试。
- HTML 内联脚本使用 `node tools/check-inline-js.mjs <页面>`；
  JavaScript 使用相应 `node --test` 或独立 Node 脚本；PHP 先做 `php -l`。
  各模块的命令与特殊条件见开发验证文档。
- 测试以有界前台进程运行；记录可能产生子进程的命令/PID，超时后精确清理整个
  本任务进程树，重试前和交付前核验。开发服务按用户要求保留时给出停止方式。
- 不把本地素材缺失、环境差异或基线失败当作通过，也不放宽断言获取绿色结果。
  交付说明列出实际命令、结果、未运行项和未解决问题。
- Git diff 中检查临时产物、调试代码、凭据、个人绝对路径及非任务改动。

## Agent skills

本仓库的 skill 仅在用户当前任务点名后使用。读取这些配置不构成启用其他 skill；
本次初始化不扩大后续任务的 skill、子代理或远端写入授权。

### Issue tracker

任务与规格记录在 `Hanray-Zhong/ATO_assistant` 的 GitHub Issues。
See `docs/agents/issue-tracker.md`。

### Triage labels

使用 `needs-triage`、`needs-info`、`ready-for-agent`、
`ready-for-human`、`wontfix` 五个默认标签。
See `docs/agents/triage-labels.md`。

### Domain docs

采用 single-context：根目录 `GLOSSARY.md` 与 `docs/adr/`。
See `docs/agents/domain.md`。
