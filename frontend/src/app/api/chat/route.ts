import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = (await req.json()) as {
    conversation_id: string;
    kb_ids: string[];
    message: string;
    top_k?: number;
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const upstream = await fetch(`${env.backendBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      ...body,
    }),
  });

  // Pass through the streaming body as-is (Vercel AI SDK Data Stream Protocol).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": upstream.headers.get("x-vercel-ai-data-stream") ?? "v1",
      // Prevent proxy buffering
      "cache-control": "no-cache, no-transform",
    },
  });
}

