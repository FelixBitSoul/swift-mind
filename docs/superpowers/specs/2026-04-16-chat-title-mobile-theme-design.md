## Backend: generate conversation title (after first turn)

### Endpoint

- **method/path**: `POST /api/conversations/{id}/title/generate`
- **auth**: required `Authorization: Bearer <Supabase JWT>`
- **response**: `200 OK`

```json
{ "data": { "title": "..." } }
```

### Behavior

- **Source text**: uses the first **user** message, plus the first **assistant** message after that, in `messages` (ordered by `created_at ASC`), scoped by authenticated `user_id`.
- **First turn incomplete**: if either first user or assistant message is missing, returns **`409`**.
- **Do not overwrite custom titles**: updates `conversations.title` **only** when title is considered “default”:
  - null / blank
  - exactly `"New conversation"` or `"Untitled"`
  - exactly equals the frontend draft title: first user text trimmed, truncated to 60 chars with an ellipsis (`…`) when longer
- **LLM constraints**: non-streaming DeepSeek completion; output is cleaned (no URLs/markdown/quotes) and bounded to <= 40 chars before persisting.

