import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const upstream = await fetch(`${env.backendBaseUrl}/api/conversations/${id}/title/generate`, {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: await req.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

