"use client";

import { useQuery } from "@tanstack/react-query";

export type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  const res = await fetch("/api/knowledge-bases", { method: "GET" });
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as { data: KnowledgeBase[] };
  return json.data;
}

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: fetchKnowledgeBases,
  });
}

