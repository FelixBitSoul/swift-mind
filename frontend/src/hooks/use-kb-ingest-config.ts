"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { kbQueryKey } from "@/hooks/use-knowledge-bases";
import { readErrorMessage } from "@/lib/http";

export type KBIngestConfig = {
  parser_id?: string;
  parser_params?: Record<string, unknown>;
  splitter_id?: string;
  splitter_params?: Record<string, unknown>;
} | null;

export function useUpdateKBIngestConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kbId: string; ingest_config: KBIngestConfig }) => {
      const res = await fetch(`/api/knowledge-bases/${input.kbId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingest_config: input.ingest_config }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return (await res.json()) as unknown;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kbQueryKey });
    },
  });
}

