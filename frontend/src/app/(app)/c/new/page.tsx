import { redirect } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewConversationPage(props: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await props.searchParams;
  const draftId = sp.draft ?? null;

  return <ChatThread key={`draft-${draftId ?? "default"}`} conversationId="__draft__" initialMessages={[]} draftId={draftId} />;
}

