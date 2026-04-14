import { redirect } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ConversationPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

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

  return <ChatThread key={id} conversationId={id} initialMessages={initialMessages} />;
}

