"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { readErrorMessage } from "@/lib/http"

export type KBDocument = {
  id: string
  kb_id: string
  title: string
  source: string | null
  mime_type: string | null
  bucket?: string | null
  path?: string | null
  status: "uploaded" | "processing" | "ready" | "failed" | string
  error: string | null
  created_at: string
  updated_at: string
}

type ListDocumentsResponse = { data: KBDocument[] }

export function kbDocumentsQueryKey(kbId: string) {
  return ["kb-documents", kbId] as const
}

export function useKBDocuments(kbId: string) {
  return useQuery({
    queryKey: kbDocumentsQueryKey(kbId),
    queryFn: async (): Promise<KBDocument[]> => {
      const res = await fetch(`/api/knowledge-bases/${kbId}/documents`, { method: "GET" })
      if (!res.ok) throw new Error(await readErrorMessage(res))
      const json = (await res.json()) as ListDocumentsResponse
      return json.data
    },
  })
}

export function useDeleteDocument(opts?: { kbId?: string }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await readErrorMessage(res))
      return (await res.json()) as { ok: boolean }
    },
    onSuccess: async () => {
      if (opts?.kbId) {
        await queryClient.invalidateQueries({ queryKey: kbDocumentsQueryKey(opts.kbId) })
      }
    },
  })
}

export function useUploadKBDocuments(opts: { kbId: string }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      files: File[]
      parser_config?: { parser_id: string; params: Record<string, unknown> } | null
      splitter_config?: { splitter_id: string; params: Record<string, unknown> } | null
    }) => {
      const form = new FormData()
      for (const f of input.files) form.append("files", f)

      const res = await fetch(`/api/knowledge-bases/${opts.kbId}/documents`, {
        method: "POST",
        body: form,
      })
      if (!res.ok) throw new Error(await readErrorMessage(res))
      const uploaded = (await res.json()) as { data: KBDocument[] }

      // Trigger ingest for each uploaded document (backend upload no longer ingests automatically).
      const tasks = uploaded.data.map(async (d) => {
        const filetype =
          (d.path?.split(".").pop() ?? d.title.split(".").pop() ?? "").toLowerCase() || null
        const ingestRes = await fetch(`/api/ingest`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kb_id: d.kb_id,
            doc_id: d.id,
            bucket: d.bucket,
            path: d.path,
            filetype,
            ...(input.parser_config ? { parser_config: input.parser_config } : {}),
            ...(input.splitter_config ? { splitter_config: input.splitter_config } : {}),
          }),
        })
        if (!ingestRes.ok) throw new Error(await readErrorMessage(ingestRes))
        return ingestRes.json()
      })

      await Promise.all(tasks)
      return uploaded
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kbDocumentsQueryKey(opts.kbId) })
    },
  })
}

