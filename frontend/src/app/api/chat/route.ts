import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageFromUIMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = isRecord(messages[i]) ? (messages[i] as Record<string, unknown>) : null;
    if (!m) continue;
    if (m.role !== "user") continue;

    // AI SDK UIMessage shape: { parts: [{ type: "text", text: string }, ...] }
    const parts = Array.isArray(m.parts) ? (m.parts as unknown[]) : null;
    if (parts) {
      const text = parts
        .filter((p) => isRecord(p) && p.type === "text")
        .map((p) => {
          if (!isRecord(p)) return "";
          return typeof p.text === "string" ? p.text : "";
        })
        .join("");
      if (text.trim()) return text.trim();
    }

    // Fallbacks
    if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
    if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
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
    (typeof payload.conversation_id === "string" ? payload.conversation_id : undefined) ??
    (isRecord(payload.body) && typeof payload.body.conversation_id === "string"
      ? payload.body.conversation_id
      : undefined);
  const kb_ids =
    (Array.isArray(payload.kb_ids) ? (payload.kb_ids as string[]) : undefined) ??
    (isRecord(payload.body) && Array.isArray(payload.body.kb_ids) ? (payload.body.kb_ids as string[]) : undefined) ??
    [];
  const top_k =
    (typeof payload.top_k === "number" ? payload.top_k : undefined) ??
    (isRecord(payload.body) && typeof payload.body.top_k === "number" ? payload.body.top_k : undefined) ??
    5;

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

  // Pass through the streaming body as-is (AI SDK Data Stream Protocol).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
      // Prevent proxy buffering
      "cache-control": "no-cache, no-transform",
    },
  });
}

