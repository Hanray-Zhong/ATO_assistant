# Triage Labels

工程技能使用五个 canonical triage roles。本仓库采用默认标签名，不复用
GitHub 的 `bug`、`question` 或 `enhancement` 代替这些状态。

| Label in mattpocock/skills | Label in our tracker | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 等待维护者评估 |
| `needs-info` | `needs-info` | 等待补充需求或复现信息 |
| `ready-for-agent` | `ready-for-agent` | 规格完整，可交由 agent 实现 |
| `ready-for-human` | `ready-for-human` | 需要人工判断或实现 |
| `wontfix` | `wontfix` | 不予处理 |

skill 提到某个角色时，使用 `Label in our tracker` 列的标签。
例如 “apply the AFK-ready triage label” 对应 `ready-for-agent`。

## Scope

- 标签所属仓库为 `Hanray-Zhong/ATO_assistant`；命令显式指定 `--repo`。
- 创建缺失标签前先列出现有标签；已有标签保留，不用 `--force` 覆盖描述或颜色。
- 标签存在不构成认领、实现、提交或其他远端写入授权。
- 初始化保留现有 `wontfix`，其余四个标签按默认名称创建。
  后续可直接修改本表来适配已有工作流。
