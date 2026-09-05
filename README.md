# inkagent

基于 [Pi](https://github.com/earendil-works/pi) 的文档生成 agent。第一版是库 + CLI，终稿为 Markdown，不做前端。

开发规范见 [AGENTS.md](./AGENTS.md)。

## 要求

- Node.js 22.19+
- 真实生成需要模型 API 密钥（环境变量，或 `pi auth`）

## 脚本

```bash
npm install
npm run typecheck
npm test
npm run build
npm run lint
npm run format:check
```

## 生成文档

```bash
npm run build
node dist/cli.js generate --input-directory ./uploads --output-directory ./output --model zai-coding-cn/glm-5.3-flash "根据这些材料写一份技术方案"
```

输入资源默认限制为 1000 个文件、单文件 50 MiB、总大小 200 MiB。可按任务需要用 `--max-input-files`、`--max-input-file-bytes` 和 `--max-input-total-bytes` 覆盖；三个参数都必须是正整数。隐藏路径不会计入限制，也不会被复制。

输入目录支持 Markdown、纯文本、HTML、常见图片，以及 anydoc 能转成 Markdown 的办公格式（PDF、Word、PPT、Excel、OpenDocument、RTF、EPUB、CSV 等）。Word 等办公文档会抽出嵌入的位图到任务目录的 `extract/` 旁的 `.assets/`；发布时这些资产会一并输出到 `extract/`，使终稿中的图片链接可用。Visio 抽不成图只留说明，轴标签碎行丢掉；封面/目次在第一个一级标题前裁掉。抽取决策见 [ingest.md](.agents/spec/ingest.md)。任务过程文件写在 `.inkagent/jobs/`（可用 `--job-directory` 覆盖）。输入、任务和输出目录不能互相包含。扫描件 PDF 需要 OCR，第一版不覆盖。输出会先写入临时目录，校验 Markdown 非空且本地引用完整后替换目标目录。

任务支持失败后恢复：

```bash
# 查看任务状态
node dist/cli.js status <job-id>

# 从抽取完成后的任务继续（模型失败或发布失败）
node dist/cli.js retry <job-id> --model zai-coding-cn/glm-5.3-flash
```

`retry` 只复用已持久化且包含可用抽取结果的任务；收集或抽取阶段失败需要重新执行 `generate`。任务记录保存在任务目录的 `job.json`，其中包含目标输出目录，因此恢复时不需要重新提供输出路径。

列出最近任务：

```bash
node dist/cli.js jobs
```

结果按任务记录更新时间倒序输出；任务目录尚不存在时返回空数组。

## 模型选择

模型必须显式指定，**不会**使用本机 Pi 的全局默认模型。优先级：

1. 命令行：`--model provider/modelId --thinking-level high`
2. 项目配置文件 `inkagent.json`（建议提交到仓库供团队共享）：

   ```json
   {
     "model": "zai-coding-cn/glm-5.3-flash",
     "thinkingLevel": "xhigh",
     "pi": {
       "providers": {
         "zai-coding-cn": {
           "models": [
             {
               "id": "glm-5.3-flash",
               "name": "GLM-5.3 Flash",
               "reasoning": true,
               "input": ["text", "image"],
               "cost": { "input": 0.15, "output": 0.5, "cacheRead": 0.03, "cacheWrite": 0 },
               "contextWindow": 1000000,
               "maxTokens": 131072
             }
           ]
         }
       }
     }
   }
   ```

   `pi.providers` 与 Pi 的 `models.json` 同形，原样交给 Pi。`input` 含 `"image"` 时，agent 读位图会把图发给模型。运行时**不会**读取本机 `~/.pi/agent/models.json`。

列出当前密钥下可用的模型：

```bash
node dist/cli.js models
```

密钥仍走环境变量（例如 `ZAI_CODING_CN_API_KEY`）或 `pi auth`。没有 `--model` 且没有 `inkagent.json` 的 `model` 时会直接报错。
