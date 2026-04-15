## Frontend (Next.js + shadcn/ui + Supabase SSR + Vercel AI SDK)

## Getting Started

Install (China mirror recommended):

```bash
cd frontend
npm_config_registry=https://registry.npmmirror.com npm install
```

Alternatively (recommended), keep a project-local `.npmrc`:

```ini
registry=https://registry.npmmirror.com
```

Env:

```bash
cp .env.example .env
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BACKEND_BASE_URL` (Python backend base URL, e.g. `http://localhost:8000`)

Run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Auth + Route Protection

- Uses `@supabase/ssr` for server-side session handling.
- `middleware.ts` redirects unauthenticated requests to `/login`.

## GitHub OAuth Login (Supabase)

This project supports **email/password** login and **GitHub OAuth** login via Supabase.

### 1) Enable GitHub provider in Supabase

In Supabase Dashboard → Authentication → Providers → GitHub:
- Enable GitHub
- Fill **Client ID** and **Client Secret** from your GitHub OAuth App

In Supabase Dashboard → Authentication → URL Configuration:
- Add Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://<your-domain>/auth/callback`

### 2) Create a GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App:
- **Homepage URL**
  - `http://localhost:3000` (local)
  - `https://<your-domain>` (production)
- **Authorization callback URL** (Supabase callback)
  - `https://<your-supabase-ref>.supabase.co/auth/v1/callback`

### 3) Try it

Open `/login` and click **Continue with GitHub**. After authorization you'll return to the app and the session cookie will be set.

## Chat Streaming

- UI uses Vercel AI SDK `useChat`.
- Frontend calls `POST /api/chat` (Next.js Route Handler) which:
  - injects `Authorization: Bearer <Supabase access_token>`
  - proxies to the Python backend `/api/chat`
  - streams the response back using Vercel AI SDK Data Stream Protocol.

## Knowledge bases UI

- **List page**: `/knowledge-bases`
  - Create KB (Dialog + Form)
  - Delete KB (AlertDialog)
- **Detail page**: `/knowledge-bases/:id`
  - List documents (title / uploaded time / status)
  - Delete document
  - Auto-refresh while any document is `processing` (polling) + manual refresh

## Route handlers (selected)

These are Next.js Route Handlers that enforce Supabase session and/or proxy to the Python backend.

- `GET/POST /api/knowledge-bases` → backend `GET/POST /api/kb`
- `GET /api/knowledge-bases/:id/documents` → backend `GET /api/kb/:id/documents`
- `DELETE /api/knowledge-bases/:id` → backend `DELETE /api/kb/:id`
- `DELETE /api/documents/:id` → backend `DELETE /api/documents/:id`
- `GET/POST /api/conversations`
- `PATCH/DELETE /api/conversations/:id` (rename/delete in sidebar menu)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
