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

`--in` 支持 `.md` `.txt` `.html` `.pdf` `.docx` `.pptx` 与常见图片。任务过程文件写在 `.inkagent/jobs/`（可用 `--work-dir` 覆盖）。
