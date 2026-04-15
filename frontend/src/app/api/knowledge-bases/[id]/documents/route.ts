import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
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
  const upstream = await fetch(`${env.backendBaseUrl}/api/kb/${id}/documents`, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  const form = await req.formData();

  const upstream = await fetch(`${env.backendBaseUrl}/api/kb/${id}/documents`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    body: form,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

