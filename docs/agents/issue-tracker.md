# Issue tracker: GitHub

本仓库的 Issue 与规格记录在
[Hanray-Zhong/ATO_assistant](https://github.com/Hanray-Zhong/ATO_assistant/issues)。
使用 `gh` CLI；所有有仓库参数的命令显式指定
`--repo Hanray-Zhong/ATO_assistant`。上游 `banard2049-cpu/ATO_assistant`
用于参考，不是默认写入目标。

## Availability

GitHub Issues 需要在 fork 的 Settings → General → Features 中启用。
2026-10-13 已复核 `hasIssuesEnabled: true`，五个 triage 标签齐全，
初始化所需的 tracker 配置已完成。后续可用
`gh repo view Hanray-Zhong/ATO_assistant --json hasIssuesEnabled` 检查开关状态。

## Conventions

以下写入命令仅在用户当前任务已授权相应操作、且已完成被调用 skill 的草案确认后使用。

- **Read an issue**：
  `gh issue view <number> --repo Hanray-Zhong/ATO_assistant --json number,title,body,labels,comments`。
- **List issues**：
  `gh issue list --repo Hanray-Zhong/ATO_assistant --state open --json number,title,body,labels`；
  按任务增加 `--label` / `--state` 等筛选。
- **Create an issue**：
  `gh issue create --repo Hanray-Zhong/ATO_assistant --title "<title>" --body-file <draft-file>`。
  多行内容先写入草案文件，保留真实换行。
- **Comment on an issue**：
  `gh issue comment <number> --repo Hanray-Zhong/ATO_assistant --body-file <comment-file>`。
- **Apply / remove labels**：
  `gh issue edit <number> --repo Hanray-Zhong/ATO_assistant --add-label "<label>"` /
  `--remove-label "<label>"`。标签映射见 [Triage Labels](triage-labels.md)。
- **Close**：`gh issue close <number> --repo Hanray-Zhong/ATO_assistant`。
  需要说明时先按已授权范围发表评论。
- **Sub-issues**：CLI 支持时使用原生父子 Issue；否则子 Issue 正文写
  `Part of #<parent>`，父 Issue 使用任务列表。跨仓库引用写完整仓库名。
- 标题、规格、验收标准与工作说明默认使用简体中文，保留代码标识符及技能固定字段。

GitHub 的 Issue 与 PR 共用编号空间；先识别对象类型，再读取或修改。
不要依赖 `gh` 自动选择仓库：当前 Git checkout 的 tracking remote 可能是上游。

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

在上述 fork 中创建 GitHub Issue；遵守该 skill 的草案确认步骤。
普通讨论、只读研究或初始化不自动授权创建 Issue、评论或 PR。

## When a skill says "fetch the relevant ticket"

按 **Read an issue** 读取用户引用的 Issue。只有上游编号、仓库或链接明确时，
才从上游读取对应背景；不把上游请求自动复制或关闭。

## Wayfinding operations

仅当用户明确调用使用这些约定的 skill 时生效。

- **Map**：单个标有 `wayfinder:map` 的 Issue，正文保留
  `Notes` / `Decisions-so-far` / `Fog`。
- **Child ticket**：链接到 map 的子 Issue，类型标签为
  `wayfinder:research` / `wayfinder:prototype` /
  `wayfinder:grilling` / `wayfinder:task`。
  原生子 Issue 不可用时使用上述父子正文/任务列表约定。
- **Blocking**：支持时使用 GitHub 原生 Issue dependencies；否则在正文顶部写
  `Blocked by: #<number>, #<number>`。原生 API 的 `issue_id` 是数据库 ID，
  不是 Issue 编号；通过 `gh api repos/Hanray-Zhong/ATO_assistant/issues/<number> --jq .id` 查询。
- **Frontier**：只检查 map 的未关闭子任务，按 map 顺序选择无未关闭 blocker 且
  尚未被认领的任务；不扫描整个仓库后擅自认领。
- **Claim**：获得相应授权后，将 Issue 分配给执行者：
  `gh issue edit <number> --repo Hanray-Zhong/ATO_assistant --add-assignee @me`。
- **Resolve**：记录结果、关闭子 Issue，再在 map 的 `Decisions-so-far` 写入指针。
  发布 gist 等额外外部内容需要单独属于用户授权范围。
