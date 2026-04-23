# Ingest 多格式支持 + 用户可配置解析/分块 — 设计文档

**日期：** 2026-04-23  
**状态：** 已批准

---

## 1. 背景与目标

当前 ingest 流程仅支持 PDF（PyMuPDF）和 Markdown，解析器和分块策略硬编码在 `IngestionService` 中。

目标：
- 新增支持 TXT、HTML、Word（docx）、Excel（xlsx/xls）、CSV
- 允许用户在 KB 级别配置默认解析器和分块策略
- 允许用户在上传文档时覆盖 KB 级配置
- 后端 YAML 声明可用选项及参数 schema，前端动态渲染配置表单

---

## 2. 整体架构

### 2.1 新增文件结构

```
backend/
  app/
    infra/
      parsing/
        base.py              # BaseParser ABC
        registry.py          # ParserRegistry
        pymupdf_reader.py    # 现有，保留
        pdfplumber_reader.py # 新增
        html_reader.py       # 新增
        txt_reader.py        # 新增
        docx_reader.py       # 新增
        excel_reader.py      # 新增
        csv_reader.py        # 新增
        markdown_reader.py   # 新增（从 ingestion_service 提取）
      splitting/
        base.py              # BaseSplitter ABC
        registry.py          # SplitterRegistry
        sentence_splitter.py
        token_splitter.py
        semantic_splitter.py
        markdown_splitter.py
    config/
      ingest_options.yaml    # 可用选项声明 + 参数 schema
    services/
      ingestion_service.py   # 改造：从 registry 取 parser/splitter
    api/
      ingest.py              # 改造：接收 parser_config / splitter_config
      ingest_options.py      # 新增：GET /api/ingest/options

frontend/
  src/
    hooks/
      use-ingest-options.ts
      use-kb-ingest-config.ts
    components/
      kb/
        ingest-config-form.tsx   # 动态参数表单（复用于 KB 设置和上传对话框）
    app/
      api/
        ingest-options/route.ts       # 代理到后端
        knowledge-bases/[id]/route.ts # 支持 PATCH
```

### 2.2 数据流

```
上传文件
  → Supabase Storage
  → POST /api/ingest (带可选 parser_config / splitter_config)
  → IngestionService.ingest()
      → 合并配置（系统默认 ← KB 级 ← 请求体）
      → ParserRegistry.get(parser_id, params) → parser.parse(bytes) → ParsedDocument
      → SplitterRegistry.get(splitter_id, params) → splitter.split(doc) → nodes
      → embed → write chunks
      → 将最终生效配置写入 documents.ingest_config
```

---

## 3. YAML 配置 Schema

路径：`backend/app/config/ingest_options.yaml`

```yaml
parsers:
  pymupdf:
    label: "PyMuPDF"
    formats: [pdf]
    params:
      extract_images:
        type: boolean
        default: false
        description: "是否提取图片中的文字（OCR）"

  pdfplumber:
    label: "pdfplumber"
    formats: [pdf]
    params:
      extract_tables:
        type: boolean
        default: true
        description: "是否将表格转为 Markdown 格式"

  html_reader:
    label: "HTML Reader"
    formats: [html, htm]
    params:
      mode:
        type: enum
        values: [text_only, preserve_structure]
        default: text_only

  docx_reader:
    label: "Word Reader"
    formats: [docx, doc]
    params: {}

  excel_reader:
    label: "Excel Reader"
    formats: [xlsx, xls]
    params:
      mode:
        type: enum
        values: [row_to_text, chunk_by_rows]
        default: row_to_text
      rows_per_chunk:
        type: integer
        default: 50
        min: 10
        max: 500
        description: "chunk_by_rows 模式下每块行数"

  csv_reader:
    label: "CSV Reader"
    formats: [csv]
    params:
      mode:
        type: enum
        values: [row_to_text, chunk_by_rows]
        default: row_to_text
      rows_per_chunk:
        type: integer
        default: 50
        min: 10
        max: 500

  txt_reader:
    label: "Plain Text"
    formats: [txt]
    params: {}

  markdown_reader:
    label: "Markdown"
    formats: [md, markdown]
    params: {}

splitters:
  sentence:
    label: "Sentence Splitter"
    params:
      chunk_size:
        type: integer
        default: 1024
        min: 128
        max: 8192
      chunk_overlap:
        type: integer
        default: 128
        min: 0
        max: 512

  token:
    label: "Token Splitter"
    params:
      chunk_size:
        type: integer
        default: 512
        min: 64
        max: 4096
      chunk_overlap:
        type: integer
        default: 64
        min: 0
        max: 256

  semantic:
    label: "Semantic Splitter"
    params:
      breakpoint_percentile_threshold:
        type: integer
        default: 95
        min: 50
        max: 99
        description: "语义断点阈值，越高分块越少"

  markdown:
    label: "Markdown Node Parser"
    formats_hint: [md, markdown]
    params:
      include_metadata:
        type: boolean
        default: true
```

---

## 4. 数据库变更

```sql
-- KB 级默认配置
ALTER TABLE knowledge_bases
ADD COLUMN ingest_config JSONB DEFAULT NULL;

-- 文档实际生效配置（用于调试和重新 ingest）
ALTER TABLE documents
ADD COLUMN ingest_config JSONB DEFAULT NULL;
```

`ingest_config` 结构：
```json
{
  "parser_id": "pdfplumber",
  "parser_params": { "extract_tables": true },
  "splitter_id": "sentence",
  "splitter_params": { "chunk_size": 512, "chunk_overlap": 64 }
}
```

---

## 5. 后端实现

### 5.1 Parser 接口

```python
# infra/parsing/base.py
class BaseParser(ABC):
    @abstractmethod
    def parse(self, data: bytes, params: dict) -> ParsedDocument:
        ...
```

### 5.2 ParserRegistry

```python
class ParserRegistry:
    def __init__(self, options_path: Path): ...

    def get_for_format(self, suffix: str) -> str:
        """根据文件后缀返回默认 parser_id"""

    def get(self, parser_id: str, params: dict) -> BaseParser:
        """验证 params（Pydantic 动态模型），返回实例化的 parser"""

    def options(self) -> dict:
        """返回完整 YAML 内容，供 /api/ingest/options 使用"""
```

SplitterRegistry 结构对称，额外接受 `embed_model` 注入（SemanticSplitter 需要）。

### 5.3 各格式解析器

| 格式 | parser_id | 依赖库 | 特殊处理 |
|------|-----------|--------|---------|
| PDF | pymupdf | `pymupdf`（已有） | 现有逻辑 |
| PDF | pdfplumber | `pdfplumber` | extract_tables=true 时表格转 Markdown |
| HTML | html_reader | `beautifulsoup4`, `html2text` | text_only 剥离标签；preserve_structure 保留标题/列表 |
| DOCX | docx_reader | `python-docx` | 段落 + 表格（表格转 Markdown） |
| TXT | txt_reader | 无 | UTF-8 decode，page_count=1 |
| MD | markdown_reader | 无 | 现有逻辑提取 |
| XLSX/XLS | excel_reader | `openpyxl` | row_to_text: "col: val"；chunk_by_rows: N 行一块 |
| CSV | csv_reader | `csv`（标准库） | 同 excel_reader |

### 5.4 API 变更

**IngestBody：**
```python
class ParserConfig(BaseModel):
    parser_id: str
    params: dict = {}

class SplitterConfig(BaseModel):
    splitter_id: str
    params: dict = {}

class IngestBody(BaseModel):
    kb_id: str
    doc_id: str
    bucket: str
    path: str
    filetype: str | None = None
    parser_config: ParserConfig | None = None    # 文档级覆盖
    splitter_config: SplitterConfig | None = None
```

**新增接口：**
```
GET /api/ingest/options
→ 返回 YAML 内容（parsers + splitters），前端据此动态渲染表单
```

### 5.5 配置合并逻辑（IngestionService）

```python
SYSTEM_DEFAULTS = {
    "parser_id": "pymupdf",   # 按文件后缀自动选择时的 fallback
    "parser_params": {},
    "splitter_id": "sentence",
    "splitter_params": {"chunk_size": 1024, "chunk_overlap": 128},
}

def _resolve_config(self, req: IngestRequest, kb_config: dict | None) -> ResolvedConfig:
    # 系统默认 ← KB 级覆盖 ← 请求体覆盖
    # parser_id 未指定时，由 ParserRegistry.get_for_format(suffix) 自动推断
```

---

## 6. 前端实现

### 6.1 新增 hooks

- `use-ingest-options.ts` — `GET /api/ingest-options`，缓存，供表单使用
- `use-kb-ingest-config.ts` — `PATCH /api/knowledge-bases/[id]` 更新 `ingest_config`

### 6.2 IngestConfigForm 组件

复用于两处：
1. KB 设置页的"Ingest 配置"面板
2. 上传文档对话框的"高级设置（可选）"折叠区域

动态渲染逻辑：
- `type: integer` → `<Input type="number">` + min/max 校验
- `type: boolean` → `<Checkbox>`
- `type: enum` → `<Select>`

### 6.3 页面变更

- `knowledge-bases/[id]/page.tsx` — 新增 Ingest 配置面板
- 上传文档对话框 — 新增高级设置折叠区域
- `app/api/ingest-options/route.ts` — 新增，代理到后端 `/api/ingest/options`
- `app/api/knowledge-bases/[id]/route.ts` — 支持 PATCH

---

## 7. 新增依赖

```toml
# pyproject.toml
pdfplumber>=0.11
beautifulsoup4>=4.12
html2text>=2024.2
python-docx>=1.1
openpyxl>=3.1
pyyaml>=6.0
```

---

## 8. 测试要点

- 每种格式的 parser 单元测试（用 fixture 文件）
- 每种 splitter 的单元测试（验证 chunk 数量和内容）
- ParserRegistry / SplitterRegistry 的参数验证测试（合法参数、非法参数）
- IngestionService 配置合并逻辑测试（三层覆盖）
- `/api/ingest/options` 接口测试
- 覆盖率目标：80%+
