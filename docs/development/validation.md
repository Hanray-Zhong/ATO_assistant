# 开发验证

主站没有统一 npm/test/build 入口。以下命令来自现有脚本、README 与 CI；
从仓库根运行，特别注明工作目录的命令除外。执行前先读目标测试的文件头，
确认其素材、网络、运行时和合成数据要求。

## 工具链依据

| 范围 | 仓库依据与要求 |
| --- | --- |
| Node 检查 | `.github/workflows/resource-import-regressions.yml` 使用 Node.js 22；无 JS 包管理器或锁文件 |
| Python CI | 工作流使用 Python 3.12 |
| Asset Studio | `asset-studio/README.md` 声明 Python 3.11+；依赖固定于 `asset-studio/requirements.txt`，复用已有 `.venv` |
| PHP | 源码启动器接受 PHP 8.1+；Docker 使用 PHP 8.4；便携版具体版本读取 `tools/export_portable.py` |
| Android | CI 使用 JDK 17；导出器固定 Gradle 8.10.2、模板 AGP 8.7.3、SDK 35；无 Gradle wrapper |
| 发布审计 | `tools/audit-public-release.ps1`，由 Windows CI 执行，需要 PowerShell |
| Docker 运行测试 | `tools/test_docker_runtime.py` 需要可用 Docker；本地源码 compose 与发布 compose 分别核对 |

不要为对齐本机默认值改仓库版本，也不要自动安装全局工具。
本机版本与 CI 不同的验证只能说明该本机环境结果。

## 语法与跟踪检查

HTML 的每个内联可执行 script 可用现有 VM 检查器校验；一次传一个页面：

    node tools/check-inline-js.mjs index.html
    node tools/check-inline-js.mjs aibp/index.html
    node tools/check-inline-js.mjs technology/index.html

其他页面按修改范围替换路径；外部脚本可用 `node --check <file.js>`。
该检查器不执行页面，也不验证 CSS 布局、浏览器事件或外部依赖顺序。

    php -l router.php
    php -l api/campaign-state.php
    php -l briefing/api.php
    python tools/test_story_code_in_git.py

最后一项检查页面引用的程序已被 Git 跟踪、私有材料没有被跟踪。
新增代码在任务尚未授权暂存时，因 untracked 失败需如实说明，不能擅自暂存绕过。

## 按改动选择回归

| 改动范围 | 现有检查入口 |
| --- | --- |
| 多页面保存、账号切换、规范化 | `node --test tests/lan-save-regressions.test.cjs tests/save-normalization-regressions.test.cjs` |
| 探索结算 | `node --test tests/exploration-resource-settlement.test.cjs`，再选 `tests/exploration-*.test.cjs` 中对应功能 |
| 科技与装备 | `node --test tests/tech-tree.test.cjs tests/technology-arsenal.test.cjs tests/technology-delayed-locks.test.cjs` |
| 地图/追猎 | `node --test tests/map-tile-lookup.test.cjs tests/nemesis-path.test.cjs tests/nemesis-battle.test.cjs` |
| 战斗视线/第二屏 | `node --test aibp/tests/battle_los.test.js`、`node tools/test-second-screen-los-mirror.cjs`，再选 AIBP/ss 对应用例 |
| 故事渲染 | `node --test story/tests/c5-heading-compat.test.cjs story/tests/mixed-media.test.cjs story/tests/story-pipe-tables.test.cjs` |
| 主题与语言 | `node --test tests/global-theme.test.cjs tests/english-language.test.cjs tests/term-engine.test.cjs` |
| BGM | `node tools/test-bgm-player.cjs`、`node tools/test-story-bgm.cjs` |
| PHP 存档与账号 | `python tests/test_php_api_hardening.py`、`python tests/test_lan_account_guard.py`；使用隔离夹具与回环服务 |
| 记录附件 | `node tests/record-attachments.test.cjs`、`python -m unittest discover -s tests -p test_record_attachments.py` |
| 在线更新 | `python tests/test_app_update.py`、`node tools/test-update-check.cjs` |
| 程序打包边界 | `python tools/test_packaging_exclusions.py`、`python tools/test_docker_package_license.py` |
| Docker 安装/挂载 | Linux 环境运行 `python tools/test_docker_mounts.py`；当前本机 macOS 的 BSD sed 会影响安装子用例 |
| Android 存档协议 | `python tools/test_android_campaign_import.py`，需要 JDK 与固定 JSON jar，首次可能下载 |
| Android 资源/版本 | `python tools/test_android_resource_catalog.py`、`python tools/test_android_resource_catalog_coverage.py`、`python tools/test_android_version_code.py` |

`tests/`、`story/tests/`、`aibp/tests/`、`tools/test-*` / `tools/test_*`
均含检查。不要默认所有测试都支持一个 glob 或同一启动方式：
例如 Android 简报用例的夹具由 Android harness 生成，本地素材用例有额外前提。

Asset Studio 在 `asset-studio/` 目录运行：

    .venv/bin/python -m unittest tests.test_install_target_safety tests.test_bgm_resources -v

其 README 的全量入口为：

    .venv/bin/python -m unittest discover -s tests -v

全量入口的成功与跳过情况需实际检查；部分 APK 夹具检查只在本地夹具存在时运行。
初始化中的选定 11 项通过不代表全量已执行。

## 打包与发布

- 阅读 `tools/packaging/README.md` 后才运行导出器。导出会写入被忽略的
  `export/` 与 `tools/.packaging-cache/`，并可能下载 PHP/JDK/Gradle/SDK。
- Android 的持续发布签名、versionCode、applicationId 要按定制版计划确定。
  `release_*.ps1`、`push_android_release.ps1` 及 tag/workflow 可能写远端，
  不能作为普通本地验证入口自动执行。
- 公开源码边界审计按 CI 使用 `tools/audit-public-release.ps1`。
  缺少 PowerShell 时说明未运行，不声称其他检查等价替代。
- 启动 PHP 服务必须保留 `router.php`；接口集成测试使用合成目录、
  `ATO_DATA_DIR` 与独立 session 路径。不要以真实战役验证破坏性操作。

## 进程责任

可能运行服务或产生 worker 的检查需设置独立硬超时，保留父 PID/进程组或精确工作目录。
记录输出后，成功、失败、取消及超时均核验全部后代是否退出；
残留先 TERM、有界等待后再精确 KILL。不能使用宽泛 `pkill` / `killall`。
未清理前不重试；需要保留服务时记录 PID、日志与停止命令。

## 本次初始化的阅读基线

记录于 2026-10-13，源码 `b74fefd`，在编写项目文件前执行。
实际环境为 Node.js 24.18.0、PHP 8.5.11、pyenv Python 3.14.6；
Asset Studio 复用 `asset-studio/.venv`，基础解释器同为 pyenv Python 3.14.6。
这些是运行记录，不是新增版本约束。

| 检查 | 实际结果 |
| --- | --- |
| 九个业务页面的 `check-inline-js.mjs` | 共 8 个可执行内联 script 编译通过；三个无内联 script 的页面各返回 0 |
| `php -l`：router、campaign-state、briefing API | 三项语法检查通过；未执行 PHP 接口集成 |
| Node 选定六文件 | 140 项，138 通过、2 失败、0 跳过 |
| `tools/test_packaging_exclusions.py` | 通过 |
| `tools/test_story_code_in_git.py` | 通过，10 个页面、99 个程序引用、6 个私有材料引用 |
| Asset Studio 安装目标/BGM 两模块 | 11 项通过 |
| `tools/test_docker_mounts.py` | 失败，8 个安装行为子用例报 `sed: -e: No such file or directory` |

Node 六文件为：

    node --test tests/lan-save-regressions.test.cjs tests/save-normalization-regressions.test.cjs tests/exploration-resource-settlement.test.cjs tests/tech-tree.test.cjs story/tests/mixed-media.test.cjs aibp/tests/battle_los.test.js

两项失败都在 `story/tests/mixed-media.test.cjs`：
`all local mappings match exact source and immutable asset hashes` 与
`all mapped entries use real main and second-screen branches without dropping planned graphics`。
它们在本地私有正文、映射文件存在时运行，当前分别出现一致性断言与图片请求数量断言失败。
尚未判定需要修复代码还是更新素材；保留原断言，另开任务排查。

Docker 安装脚本使用 GNU 风格 `sed -i`，本次由 macOS BSD sed 执行；
工作流在 Linux 上运行该检查。本次结果不能证明 Linux 通过，需在对应环境复核。

未运行：浏览器交互/视觉验证、PHP 接口集成、Asset Studio 全量、Android harness/APK、
Portable 导出、Docker 容器运行、PowerShell 公开发布审计和完整 CI。
本次任务仅建立开发文档与技能配置，没有验证全部运行行为。
