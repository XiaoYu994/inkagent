# AGENTS.md

本仓库的开发规范采用**渐进式披露**：

| 层         | 位置                                               | 何时进入上下文                             |
| ---------- | -------------------------------------------------- | ------------------------------------------ |
| 协议与索引 | 本文件                                             | 会话开始时自动加载                         |
| 条文正文   | [`.agents/spec/`](.agents/spec/)                   | 按任务用文件工具打开，禁止整目录一次性读入 |
| 来源与目录 | [`.agents/spec/README.md`](.agents/spec/README.md) | 维护规范或查来源时再读                     |

条文只住在 `.agents/spec/`。本文件不复述细则。凭记忆执行规范**不算已读**。规范文件以主题 kebab-case 命名，不加序号；顺序由本文加载表与 README 目录决定。

## 工作协议

改代码、写测试、做评审、创建分支、提交或开合并请求之前：

1. 用下面的加载表选出 1～3 个文件（默认先读命名与函数；Git 操作读分支与提交两份）。
2. 用文件工具**实际读取**这些文件。不要凭训练数据里的印象动手。
3. 用所读文件文末的**自查清单**对照本次 diff 或本次 Git 操作。
4. 引用规范时用 `functions §7`、`branching §3`、`commits §2` 这种形式；不要把条文粘进回复。

**未读取加载表命中的文件，不得开始改代码或动 Git。** 一次不要打开全部规范文件。

## 加载表

任何生产代码改动，先读：

- [`.agents/spec/naming.md`](.agents/spec/naming.md)
- [`.agents/spec/functions.md`](.agents/spec/functions.md)

然后按当前工作**追加**，而不是替换：

| 即将做的事                                                       | 再读                                                |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| 写注释、文档字符串，或删注释                                     | [comments.md](.agents/spec/comments.md)             |
| 组织文件、排函数顺序、新建源文件                                 | [formatting.md](.agents/spec/formatting.md)         |
| 设计类型/模块边界、封装数据、接入第三方、出现链式 `.get().get()` | [abstraction.md](.agents/spec/abstraction.md)       |
| 抛错、捕获、返回错误、处理空值或缺省                             | [error-handling.md](.agents/spec/error-handling.md) |
| 写测试、改测试、评审测试；重构前确认保护网                       | [testing.md](.agents/spec/testing.md)               |
| 改既有结构、识别坏味道、加功能前铺路                             | [refactoring.md](.agents/spec/refactoring.md)       |
| 建分支、开合并请求、发版、热修                                   | [branching.md](.agents/spec/branching.md)           |
| 写 commit、squash 说明、整理提交历史                             | [commits.md](.agents/spec/commits.md)               |
| 评审 diff                                                        | 按改动主题打开对应文件，用文末清单当评审问题        |

只改测试则 `naming` + `testing` 即可，不必再读 `functions`。只改注释则 `comments`。从开分支到提交：同时读 `branching` + `commits`，不必先读 `naming`/`functions`。

## 全局默认

这些是协议，不是条文摘要：

- **编码规范语言无关**：语法与惯用法跟项目语言；结构、命名、抽象、错误处理、测试与重构跟对应 spec。
- **Git**：GitHub Flow + Conventional Commits。主干始终可部署；工作项用仓库 Issue。见 [branching.md](.agents/spec/branching.md)、[commits.md](.agents/spec/commits.md)。
- **唯一目的**：降低下一次修改的成本。某条规则在当前场景让代码更难改，允许偏离。
- **偏离**：写明偏离了哪一条、为什么；同一偏离反复出现则修订规范，不要默默复制例外。
- **童子军军规**：顺手只修本次任务能负担的问题，不做超范围迁移。
- **两顶帽子**：加功能与重构不同时做，也不塞进同一次提交。见 [refactoring.md](.agents/spec/refactoring.md)。
- **生成代码**：与手写同一套验收标准。"能跑"不够。

## 构建与测试

- 安装：`npm install`（Node.js 22+）
- 类型检查：`npm run typecheck`
- 测试：`npm test`
- 构建：`npm run build`
- 检查风格：`npm run lint`

## 完成标准

一次改动在以下全部成立之前不算完成：

- 本会话中实际读取了加载表命中的文件
- 命中文件的自查清单已对照 diff 或 Git 操作
- 需要偏离的条文已显式说明

## 维护本规范

改 `.agents/spec/` 时：

- 一条事实只放一处。本文件只保留协议与加载表。
- 文件名用主题 kebab-case，不加序号。
- 新增或拆分主题文件时，同步更新本文件的加载表和 [`.agents/spec/README.md`](.agents/spec/README.md) 的目录。
- 每个规范文件开头保留一行 **何时阅读**，与加载表一致，不在正文里再写一套"如何使用"。
