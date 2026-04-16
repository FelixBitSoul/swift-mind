# 知识库问答：引用来源展示（设计稿）

日期：2026-04-16  
范围：知识库对话（Chat / RAG）在每条 AI 回复下方展示引用来源卡片列表（方案 A）

## 背景与目标

当前系统会从 `doc_chunks` 检索相关片段并拼接为 `CONTEXT` 交给模型，但前端仅接收纯文本流式输出，无法将检索到的片段以“引用来源”的形式展示给用户。

本设计实现以下目标：

- 在每条 **assistant** 回复下方展示“引用来源”卡片列表
- 引用来源来自本次检索命中的 `doc_chunks`（top_k）
- 保持多租户与权限边界：仅展示属于当前 `user_id` 且属于所选 `kb_ids` 的来源

非目标：

- 在回答正文中插入脚注编号（如 `[1]`）与正文引用映射
- 在文档详情页实现按 chunk 精确定位（可作为后续增强）

## 现状概览（关键信息）

- 后端：`backend/app/services/chat_service.py`
  - `_retrieve()` 从 `doc_chunks` 检索 `NodeWithScore`
  - `_format_context()` 将 nodes 格式化成文本 `CONTEXT`（包含 score、metadata、text）
  - `stream_chat()` 目前逐 token `yield token.encode("utf-8")`（纯文本流）
- 前端：
  - `frontend/src/hooks/use-rag-chat.ts` 使用 `TextStreamChatTransport`
  - `frontend/src/components/chat/chat-thread.tsx` 渲染 `UIMessage.parts` 的文本
  - `frontend/src/app/api/chat/route.ts` 透传后端流式响应

## 方案选择

采用 **方案 1：AI SDK Data Stream Protocol**（推荐方案）。

### 为什么选它

- 单次请求即可获得：回答文本 + 结构化 `citations`
- 与仓库后端规范一致（Data Stream Protocol parts：`0:` 文本 + `d:` finish）
- 引用能与“这条 assistant 消息”天然绑定，避免二次请求与额外状态机

## 数据模型（Citation）

每条 assistant 回复携带 `citations: Citation[]`，其中：

```ts
type Citation = {
  kb_id: string;
  doc_id: string;
  chunk_id: string;
  chunk_index?: number;
  title?: string;   // 优先展示
  source?: string;  // 次级展示（文件名/来源）
  score?: number;   // 相似度/相关性分数
  snippet: string;  // 展示用摘录（来自 chunk 文本截断）
};
```

约束：

- `citations` 顺序与检索排序一致（score 降序）
- `snippet` 默认截断为可读短文本（例如 200–400 字符），并保证 UTF-8 安全

## API 设计（流式输出）

### 路由

- 后端：`POST /api/chat`（保持不变）
- 前端：`POST /api/chat`（Next.js route，透传保持不变）

### Streaming 协议

后端 `/api/chat` 从“纯文本流”升级为 **Data Stream Protocol**：

- **文本 token part**
  - `0:"<token>"\n`
- **结束 part（携带引用）**
  - `d:{"citations":[...]} \n`

错误与空命中：

- 检索失败或无命中时：`citations: []`
- 回答仍可继续生成（引用缺失不应阻断回答）

兼容性：

- 前端 `useRagChat` 需要切换到能解析 Data Stream Protocol 的 transport（不再使用 `TextStreamChatTransport`）
- `frontend/src/app/api/chat/route.ts` 作为透传层无需理解内容，只需透传 body 与 headers

## 前端 UI 设计（方案 A：卡片列表）

在 `ChatThread` 渲染每条 `assistant` 消息时，在 markdown 内容下方追加 “引用来源” 区块。

### 展示规则

- **无 citations**：不展示该区块
- **有 citations**：展示标题“引用来源”，下方显示最多 `top_k` 条卡片

### 卡片内容（每条）

- 标题：优先 `title`，否则 `source`，最后兜底为 `doc_id`
- 分数：`score`（展示格式可为小数保留 2 位或百分比，最终以实现为准）
- 摘录：`snippet`（2–3 行，超出折叠）

### 交互

- 点击卡片：打开文档详情页
  - 若已有文档页面：跳转并尽量附带参数用于后续定位（例如 `?chunk=<chunk_id>`）
  - 若暂无文档详情页：先跳转到知识库的 documents 列表并高亮/定位（实现阶段再按现状选最接近的）

## 安全与多租户

- 后端检索必须强制过滤：
  - `user_id = CurrentUser.user_id`
  - `kb_id IN selected kb_ids`
- 禁止从客户端接受 `user_id`
- 引用来源中仅返回满足上述过滤的文档与 chunk

## 观测与测试（高层）

- 手动验收：
  - 选择 KB → 提问 → 回答下方出现引用来源卡片列表
  - 无命中/空 KB：回答正常、无引用区块
- 单元/集成（可选，按现有测试体系补齐）：
  - citations 映射与截断逻辑
  - Data Stream 协议输出格式（`0:` 与 `d:`）

