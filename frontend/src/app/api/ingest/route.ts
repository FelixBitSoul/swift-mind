import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
}

export async function POST(req: Request) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.text();
  const upstream = await fetch(`${env.backendBaseUrl}/api/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

