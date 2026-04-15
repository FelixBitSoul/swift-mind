import { redirect } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewConversationPage(props: {
  searchParams: Promise<{ draft?: string; kb_ids?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await props.searchParams;
  const draftId = sp.draft ?? null;
  const initialKbIds = sp.kb_ids?.trim() ? sp.kb_ids.split(",").map((x) => x.trim()).filter(Boolean) : undefined;

  return (
    <ChatThread
      key={`draft-${draftId ?? "default"}`}
      conversationId="__draft__"
      initialMessages={[]}
      draftId={draftId}
      initialKbIds={initialKbIds}
    />
  );
}

