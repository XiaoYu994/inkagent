# 材料抽取

**何时阅读：** 改抽取、anydoc 适配、办公文档如何进入 agent，或处理封面/图/表噪音之前。加载协议见仓库根目录 [AGENTS.md](../../AGENTS.md)。

抽取的目标是让 agent 只看到**可引用的正文**：真表、正文段落、能读的位图。不是「把 Word 无损变成 Markdown」。

## 决策

### 1. 用 anydoc 的 document 模型，而不是只 `toMarkdown`

办公格式走 `toDocument`，再由本仓库序列化。PDF 仍走 `toMarkdown`（anydoc 对 PDF 没有 document 模型）。CSV 等无签名格式必须把 `formatFromPath` 传给 `toDocument`。

anydoc 的类型停在 `src/ingest/`，不泄漏到 generate / agent。

### 2. 图当图，表当表

- 嵌入的 PNG/JPEG/GIF/WebP 写到 `extract/<kind>/….assets/`，Markdown 用相对 **job 根** 的路径（`extract/docx/…`），因为会话 cwd 是 job 目录。
- Visio 等 OLE（`.vsd`）第一版**不渲染**：不落盘、不接入 LibreOffice / libvisio。图位置只留「未能转成图片」。量值信旁边的 Word 数据表。
- 连续 ≥3 行无标点短段落视为绘图轴标签，**直接丢掉**，不标 `layout-debris`（标了仍会进上下文，模型会当数据用）。
- anydoc 标成 `layout` 的表加「排版框（非数据表）」前缀。封面签字栏在实测里常被标成 `data`，不能靠这个区分封面。

### 3. 封面与目次在抽取之后裁，不在抽取之前改 Word

anydoc **没有**去封面 API。抽取前改 docx 会弄脏材料，Word 分页也不稳定。

裁点：`toDocument` 之后、写成 Markdown 之前，丢掉**第一个一级标题之前**的块（封面表、更改记录、目次）。无一级标题则整篇保留。封面里的位图若未被正文引用，不写入 `.assets/`。

不要用 prompt 说「忽略封面」。

### 4. 第一版不把 Visio 当独立解析问题来解

没有和 anydoc 同档的「docx 内嵌 Visio → 图」npm 包。可选后路是抽出 OLE 再交给 LibreOffice `soffice` 或 libvisio 渲 PNG；那是系统依赖，不进第一版。

## 仍存在的问题

- **Visio / 谱线图看不见。** 模板里图 2/3/4/6 是 `.vsd`。agent 只能看题注和邻表；图意本身丢失。
- **一级标题启发式会漏或切错。** 封面标题若是 Heading 1，封面会留下来；全文没有 H1 时封面和目次会进 agent。
- **封面表被标成 data。** 「排版框」规则盖不住军工模板的签字栏，必须靠 H1 裁切。
- **PDF 抽不出嵌入图资产。** 扫描件 PDF 仍不支持 OCR。
- **Word 原生 Chart 的 `chart*.xml` 未解析。** 与 Visio OLE 不是同一条路，以后可分开做。

## 自查清单

- [ ] 办公抽取是否走 `toDocument`，PDF 是否仍走 `toMarkdown`？
- [ ] 图片链接是否相对 job 根（`extract/…`），而不是相对 md 文件？
- [ ] Visio/OLE 是否既没有落盘也没有把轴标签碎行留给模型？
- [ ] 有一级标题时，封面/目次是否在序列化前被裁掉？
- [ ] 这次是否把「去封面」或「渲 Visio」推进了 prompt 或抽取前改 docx？那是偏离，需要写明原因。
