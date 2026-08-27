# 开发规范总览

本目录是规范**条文正文**。Agent 的加载协议与索引在仓库根目录 [AGENTS.md](../../AGENTS.md)，不在本文件。

文件名用主题 kebab-case，不加序号。编码类条文源自《Clean Code》（Robert C. Martin）与《重构：改善既有代码的设计》（Martin Fowler）。Git 类条文采用 GitHub Flow 与 Conventional Commits，而不是某一套上线环境矩阵。

## 定位与范围

- **编码规范语言无关**：针对命名、函数、注释、抽象、错误处理、测试与重构。示例仅为示意，编码时遵循项目所用语言的惯用法。
- **Git**：日常 [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)；提交 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)。工作项用仓库 Issue。见 [branching.md](./branching.md)、[commits.md](./commits.md)。
- **目标读者**：本项目中的人类工程师与 AI 编程代理。
- **唯一目的**：降低下一次修改代码的成本。一条规则如果导致代码更难改，它在该场景下失效，应当偏离并留下说明。

## 文档索引

| 文件 | 主题 | 主要来源 |
| --- | --- | --- |
| [naming.md](./naming.md) | 命名 | Clean Code 第 2 章 |
| [functions.md](./functions.md) | 函数与方法 | Clean Code 第 3 章 |
| [comments.md](./comments.md) | 注释 | Clean Code 第 4 章 |
| [formatting.md](./formatting.md) | 格式与代码组织 | Clean Code 第 5 章 |
| [abstraction.md](./abstraction.md) | 数据结构与抽象 | Clean Code 第 6、8、9 章 |
| [error-handling.md](./error-handling.md) | 错误处理 | Clean Code 第 7 章 |
| [testing.md](./testing.md) | 测试 | Clean Code 第 9 章、TDD 实践 |
| [refactoring.md](./refactoring.md) | 重构与代码坏味道 | 《重构》全书 |
| [branching.md](./branching.md) | 分支与合并 | GitHub Flow |
| [commits.md](./commits.md) | 提交说明 | Conventional Commits 1.0.0 |

「何时打开哪一份」以 [AGENTS.md](../../AGENTS.md) 的加载表为准。本目录只保留条文，避免与协议重复。

## 人类查阅

写新代码：从 [naming.md](./naming.md)、[functions.md](./functions.md) 开始，其余按主题打开。

改老代码：按 [refactoring.md](./refactoring.md) 识别坏味道 → 选手法 → 小步重构 + 测试保护。童子军军规：只顺手修本次能负担的问题。

建分支、开合并请求、发版：读 [branching.md](./branching.md)。写提交：读 [commits.md](./commits.md)。

评审：用各文件文末的自查清单。引用具体条目，如 `functions §3`、`branching §3`、`commits §2`。

## 偏离规范

规范是默认决策，不是法律。偏离时：

1. 明确知道自己在偏离哪一条；
2. 在代码处或合并请求说明原因；
3. 同一偏离反复出现，修订规范，而不是默默复制例外。

> "让营地比你来时更干净。" —— 童子军军规
