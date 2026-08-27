# inkagent

基于 [Pi](https://github.com/earendil-works/pi) 的文档生成 agent。第一版是库 + CLI，终稿为 Markdown，不做前端。

开发规范见 [AGENTS.md](./AGENTS.md)。

## 要求

- Node.js 22.13+
- 真实生成需要已配置的 Pi 模型密钥（`pi auth` 或相应环境变量）

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
node dist/cli.js generate --in ./uploads --out ./output "根据这些材料写一份技术方案"
```

`--in` 支持 Markdown / 纯文本 / HTML / 常见图片，以及 anydoc 能转成 Markdown 的办公格式（PDF、Word、PPT、Excel、OpenDocument、RTF、EPUB、CSV 等）。任务过程文件写在 `.inkagent/jobs/`（可用 `--work-dir` 覆盖）。扫描件 PDF 需要 OCR，第一版不覆盖。

## 模型选择

按优先级取用：

1. 命令行覆盖：`--model provider/modelId --thinking-level high`
2. 项目配置文件 `inkagent.json`（建议提交到仓库供团队共享）：

   ```json
   {
     "model": "zai-coding-cn/glm-5.3-flash",
     "thinkingLevel": "xhigh"
   }
   ```

3. 都未指定时沿用你 Pi 全局默认（`pi auth` 与 pi 设置里的 defaultModel）。
