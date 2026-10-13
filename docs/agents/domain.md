# Domain Docs

本项目采用 **single-context**。主站、Android 壳和素材工具共享 ATO 战役与资源概念；
独立运行入口不构成多包 monorepo，本仓库不使用 `GLOSSARY-MAP.md` 布局。

## Before exploring, read these

- 根目录 `GLOSSARY.md`，如果存在。
- `docs/adr/` 中涉及当前任务的 ADR，如果存在。
- 代码入口与当前行为参考 [项目导读](../development/project-map.md)，
  涉及模块仍以其源码、测试和现有 README 为准。

若 glossary 或 ADR 不存在，继续工作，不因缺失阻塞、警告或建议预先填充。
仅在用户明确调用相应领域建模 skill、且术语或决策已经澄清时，
按该 skill 的流程延迟创建；本文不自动授权调用其他 skill。

## File structure

以下为约定位置；初始化不会为了占位而创建空 glossary 或 ADR。

    /
    ├── GLOSSARY.md
    ├── docs/
    │   ├── adr/
    │   │   └── 0001-<decision>.md
    │   ├── agents/
    │   │   ├── issue-tracker.md
    │   │   ├── triage-labels.md
    │   │   └── domain.md
    │   └── development/
    │       ├── project-map.md
    │       └── validation.md
    ├── index.html
    └── <现有业务目录>/

## Use the glossary's vocabulary

存在 glossary 时，Issue、假设、实现说明和测试名称使用其约定词汇。
尚未定义的概念先核对源码与 README；不要把账号、profile、循环、section
混称为“用户数据”，也不要擅自把游戏术语翻译成新的同义词。
真正未解决的命名留待用户授权的领域建模任务处理。

## Flag ADR conflicts

输出与既有 ADR 冲突时，明确引用编号、说明冲突及重新讨论的依据；
不能通过改写旧 ADR 把新提议描述成已接受决定。例如：

> Contradicts ADR-0007，建议重开讨论，因为当前约束发生了……。

项目导读描述观察到的实现，不等同于正式 ADR，也不自动约束未来架构选择。
