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
node dist/cli.js generate --in ./uploads --out ./output --model zai-coding-cn/glm-5.3-flash "根据这些材料写一份技术方案"
```

`--in` 支持 Markdown / 纯文本 / HTML / 常见图片，以及 anydoc 能转成 Markdown 的办公格式（PDF、Word、PPT、Excel、OpenDocument、RTF、EPUB、CSV 等）。Word 等办公文档会抽出嵌入的位图到 `extract/` 旁的 `.assets/`；Visio 抽不成图只留说明，轴标签碎行丢掉；封面/目次在第一个一级标题前裁掉。抽取决策见 [ingest.md](.agents/spec/ingest.md)。任务过程文件写在 `.inkagent/jobs/`（可用 `--work-dir` 覆盖）。扫描件 PDF 需要 OCR，第一版不覆盖。`--out` 每次生成会先清空再写入本轮 Markdown。

## 模型选择

模型必须显式指定，**不会**使用本机 Pi 的全局默认模型。优先级：

1. 命令行：`--model provider/modelId --thinking-level high`
2. 项目配置文件 `inkagent.json`（建议提交到仓库供团队共享）：

   ```json
   {
     "model": "zai-coding-cn/glm-5.3-flash",
     "thinkingLevel": "xhigh"
   }
   ```

列出当前密钥下可用的模型：

```bash
node dist/cli.js models
```

密钥仍走环境变量（例如 `ZAI_CODING_CN_API_KEY`）或 `pi auth`。没有 `--model` 且没有 `inkagent.json` 的 `model` 时会直接报错。
