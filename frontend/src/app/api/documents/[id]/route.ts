import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  const upstream = await fetch(`${env.backendBaseUrl}/api/documents/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  const upstream = await fetch(`${env.backendBaseUrl}/api/documents/${id}`, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

