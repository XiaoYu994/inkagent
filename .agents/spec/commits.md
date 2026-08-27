# 提交说明

> 一次提交只包含一件完整改动。标题让人和机器都能解析。

**何时阅读：** `git commit`、填写 squash 说明、整理提交历史之前。分支与合并请求见 [branching.md](./branching.md)。加载协议见仓库根目录 [AGENTS.md](../../AGENTS.md)。

格式遵循 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)，type 取 Angular / commitlint 的常用集。

## 1. 一次一件事

- 一个提交 = 一个意图。能单独 revert。
- 与 [refactoring.md](./refactoring.md) 的两顶帽子一致：加功能与纯重构不要写进同一次提交。
- 先看 `git diff`，再选文件暂存。禁止无差别 `git add .`。
- 不提交密钥、本机 IDE 配置、构建生成物（除非仓库明确跟踪）。

## 2. 消息格式

```text
<type>(<scope>): <description>

<body>

<footer>
```

`type` 小写、必填：

| type | 何时用 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修缺陷 |
| `docs` | 只改文档 |
| `style` | 格式，不影响行为 |
| `refactor` | 行为不变的结构变化 |
| `perf` | 性能 |
| `test` | 只改测试 |
| `build` | 构建系统或依赖 |
| `ci` | CI 配置 |
| `chore` | 其它杂务 |
| `revert` | 回滚某次提交 |

- `scope` 可选，小写，标明模块，如 `spec`、`api`。
- `description`：祈使语气（This commit will …）、不加句号、建议不超过 72 字符。
- `type` / `scope` 用英文。`description` 本仓库用中文。
- 正文可选，与标题空一行；写清动机和关键取舍，不复述 diff。
- 破坏性变更：类型后加 `!`（`feat(api)!: ...`），或在 footer 写 `BREAKING CHANGE: ...`。
- 关联 Issue：修完用 `Closes #42` 或 `Fixes #42`；未修完用 `Refs #42`。不要用 Jira 键。

## 3. 示例

```text
feat(spec): 用 GitHub Flow 替换版本矩阵

去掉按版本拉分支和 SIT 环境表。日常从 main 拉短分支，
发版用 tag；仅在并行维护旧版本时才启用 release 线。

Closes #12
```

```text
fix: 防止空配置路径触发空指针
```

```text
feat(api)!: 删除已废弃的 v1 查询参数

BREAKING CHANGE: 调用方改用 filter 对象，不再接受 ?q=
```

不要写：`update`、`fix bug`、`WIP`、`最终版本`、`调整一下`。

## 4. 历史

- 未推送的本地提交可以 `rebase -i` 整理。
- 已出现在共享主干上的历史禁止 force-push。
- 短分支在合入主干前可以 rebase 到最新主干。
- 回滚用 `revert:`，并在 footer `Refs:` 原提交 SHA。
- squash 合入时，合并请求的最终说明必须仍符合 §2。不要把一串 `WIP` 留在主干上。

## 自查清单

- [ ] 这次提交能不能一句话说清？混进第二件事了吗？
- [ ] 第一行是 `type(scope): 描述` 吗？有句号或超过 72 字符吗？
- [ ] 该关联的 Issue 写在 footer 了吗？
- [ ] 有没有暂存到密钥、生成物或无关文件？
- [ ] 破坏性变更是否标了 `!` 或 `BREAKING CHANGE`？
