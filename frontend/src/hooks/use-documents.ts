"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
      if (!res.ok)
        throw new Error((await res.json().catch(() => null))?.error ?? (await res.text()))
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
      if (!res.ok)
        throw new Error((await res.json().catch(() => null))?.error ?? (await res.text()))
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
    mutationFn: async (files: File[]) => {
      const form = new FormData()
      for (const f of files) form.append("files", f)

      const res = await fetch(`/api/knowledge-bases/${opts.kbId}/documents`, {
        method: "POST",
        body: form,
      })
      if (!res.ok)
        throw new Error((await res.json().catch(() => null))?.error ?? (await res.text()))
      return (await res.json()) as { data: KBDocument[] }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kbDocumentsQueryKey(opts.kbId) })
    },
  })
}

