## Frontend (Next.js + shadcn/ui + Supabase SSR + Vercel AI SDK)

## Getting Started

Install (China mirror recommended):

```bash
cd frontend
npm_config_registry=https://registry.npmmirror.com npm install
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

## Chat Streaming

- UI uses Vercel AI SDK `useChat`.
- Frontend calls `POST /api/chat` (Next.js Route Handler) which:
  - injects `Authorization: Bearer <Supabase access_token>`
  - proxies to the Python backend `/api/chat`
  - streams the response back using Vercel AI SDK Data Stream Protocol.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
