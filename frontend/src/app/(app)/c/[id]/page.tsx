import { redirect } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ConversationPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prompt?: string; kb_ids?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    // Keep UI simple; user will see empty thread if RLS blocks or convo missing.
  }

  const initialMessages: { id: string; role: "system" | "user" | "assistant"; content: string }[] = (
    data ?? []
  ).map((m) => ({
    id: String(m.id),
    role: m.role as "system" | "user" | "assistant",
    content: String(m.content ?? ""),
  }));

  const kbIdsFromQuery = sp.kb_ids?.trim() ? sp.kb_ids.split(",").map((x) => x.trim()).filter(Boolean) : null;
  const { data: convoRow } = await supabase
    .from("conversations")
    .select("kb_ids")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const initialKbIds =
    kbIdsFromQuery && kbIdsFromQuery.length
      ? kbIdsFromQuery
      : Array.isArray(convoRow?.kb_ids)
        ? convoRow!.kb_ids.map(String).filter(Boolean)
        : undefined;
  const prompt = sp.prompt?.trim() ? sp.prompt : null;

  return (
    <ChatThread
      key={id}
      conversationId={id}
      initialMessages={initialMessages}
      initialKbIds={initialKbIds}
      autoSendText={prompt}
    />
  );
}

