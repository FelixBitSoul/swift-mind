"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type KnowledgeBasesListResponse = { data: KnowledgeBase[] };

async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  const res = await fetch("/api/knowledge-bases", { method: "GET" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? (await res.text()));
  const json = (await res.json()) as KnowledgeBasesListResponse;
  return json.data;
}

export const kbQueryKey = ["knowledge-bases"] as const;

export function useKBs() {
  return useQuery({
    queryKey: kbQueryKey,
    queryFn: fetchKnowledgeBases,
  });
}

export function useCreateKB() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          description: input.description ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? (await res.text()));
      return (await res.json()) as KnowledgeBase;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kbQueryKey });
    },
  });
}

export function useDeleteKB() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kbId: string) => {
      const res = await fetch(`/api/knowledge-bases/${kbId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? (await res.text()));
      return (await res.json()) as { ok: boolean };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kbQueryKey });
    },
  });
}

export function useUpdateKB() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kbId: string; name?: string; description?: string | null }) => {
      const res = await fetch(`/api/knowledge-bases/${input.kbId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? (await res.text()));
      return (await res.json()) as KnowledgeBase;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kbQueryKey });
    },
  });
}

