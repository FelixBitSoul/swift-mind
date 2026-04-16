import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversation_id");
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
  }

  const withMeta = await supabase
    .from("messages")
    .select("id,role,content,metadata,created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!withMeta.error) return NextResponse.json({ data: withMeta.data ?? [] });

  // Backward-compatible: if `metadata` column doesn't exist yet, retry without it.
  if (
    withMeta.error.message.includes("metadata") ||
    withMeta.error.message.toLowerCase().includes("column") ||
    withMeta.error.message.toLowerCase().includes("not found")
  ) {
    const withoutMeta = await supabase
      .from("messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (withoutMeta.error) return NextResponse.json({ error: withoutMeta.error.message }, { status: 400 });
    return NextResponse.json({ data: withoutMeta.data ?? [] });
  }

  return NextResponse.json({ error: withMeta.error.message }, { status: 400 });
}

