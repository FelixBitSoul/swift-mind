import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function messageFromUIMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as Record<string, unknown> | null;
    if (!m || typeof m !== "object") continue;
    if (m.role !== "user") continue;

    // AI SDK UIMessage shape: { parts: [{ type: "text", text: string }, ...] }
    const parts = Array.isArray(m.parts) ? (m.parts as unknown[]) : null;
    if (parts) {
      const text = parts
        .filter((p) => typeof p === "object" && p !== null && (p as any).type === "text")
        .map((p) => ((p as any).text as string | undefined) ?? "")
        .join("");
      if (text.trim()) return text.trim();
    }

    // Fallbacks
    if (typeof (m as any).content === "string" && (m as any).content.trim()) return (m as any).content.trim();
    if (typeof (m as any).text === "string" && (m as any).text.trim()) return (m as any).text.trim();
  }
  return "";
}

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

  const payload = (await req.json()) as Record<string, unknown>;
  const conversation_id =
    (payload.conversation_id as string | undefined) ??
    ((payload.body as any)?.conversation_id as string | undefined);
  const kb_ids =
    (payload.kb_ids as string[] | undefined) ?? ((payload.body as any)?.kb_ids as string[] | undefined) ?? [];
  const top_k =
    (payload.top_k as number | undefined) ?? ((payload.body as any)?.top_k as number | undefined) ?? 5;

  const message =
    (payload.message as string | undefined) ??
    messageFromUIMessages(payload.messages) ??
    "";

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
      conversation_id,
      kb_ids,
      message,
      top_k,
    }),
  });

  // Pass through the streaming body as-is (AI SDK text stream protocol).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
      // Prevent proxy buffering
      "cache-control": "no-cache, no-transform",
    },
  });
}

