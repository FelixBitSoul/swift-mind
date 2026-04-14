"use client";

import { useQuery } from "@tanstack/react-query";

export type Conversation = {
  id: string;
  title: string | null;
  kb_ids: string[];
  created_at: string;
  updated_at: string;
};

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/conversations", { method: "GET" });
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as { data: Conversation[] };
  return json.data;
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });
}

