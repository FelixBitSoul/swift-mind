import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
}

export async function GET() {
  try {
    if (!env.backendBaseUrl || !env.backendBaseUrl.startsWith("http")) {
      return new Response(JSON.stringify({ error: "Server misconfigured: BACKEND_BASE_URL is missing/invalid." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const upstream = await fetch(`${env.backendBaseUrl}/api/kb`, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Upstream request failed.",
        detail: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!env.backendBaseUrl || !env.backendBaseUrl.startsWith("http")) {
      return new Response(JSON.stringify({ error: "Server misconfigured: BACKEND_BASE_URL is missing/invalid." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await req.text();
    const upstream = await fetch(`${env.backendBaseUrl}/api/kb`, {
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
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Upstream request failed.",
        detail: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

