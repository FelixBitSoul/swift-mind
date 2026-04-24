"use client";

import { useQuery } from "@tanstack/react-query";

import { readErrorMessage } from "@/lib/http";

export type IngestOptions = {
  parsers: Record<
    string,
    {
      label?: string;
      formats?: string[];
      params?: Record<string, unknown>;
    }
  >;
  splitters: Record<
    string,
    {
      label?: string;
      params?: Record<string, unknown>;
      formats_hint?: string[];
    }
  >;
};

export const ingestOptionsQueryKey = ["ingest-options"] as const;

export function useIngestOptions() {
  return useQuery({
    queryKey: ingestOptionsQueryKey,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<IngestOptions> => {
      const res = await fetch("/api/ingest-options", { method: "GET" });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return (await res.json()) as IngestOptions;
    },
  });
}

