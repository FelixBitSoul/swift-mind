import { headers } from "next/headers"
import { DocumentDetailClient } from "./ui-client"

type DocChunk = {
  id: string
  kb_id: string
  doc_id: string
  chunk_index: number | null
  content: string
}

type DocumentDetail = {
  document: {
    id: string
    kb_id: string
    title: string
    source: string | null
    mime_type: string | null
    status: string
    created_at: string
    updated_at: string
  }
  chunks: DocChunk[]
}

export default async function DocumentDetailPage(props: {
  params: Promise<{ id: string; docId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id: kbId, docId } = await props.params
  const sp = await props.searchParams
  const chunkId = typeof sp.chunk_id === "string" ? sp.chunk_id : null
  const chunkIndex = typeof sp.chunk_index === "string" ? sp.chunk_index : null

  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const origin = host ? `${proto}://${host}` : ""
  const cookie = h.get("cookie") ?? ""

  const res = await fetch(`${origin}/api/documents/${encodeURIComponent(docId)}`, {
    method: "GET",
    cache: "no-store",
    // Forward session cookies so the API route can read Supabase session.
    headers: cookie ? { cookie } : undefined,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    const msg = err?.error ?? (await res.text())
    return <div className="p-6 text-sm text-destructive">Error: {msg}</div>
  }
  const data = (await res.json()) as DocumentDetail

  if (data.document.kb_id !== kbId) {
    return <div className="p-6 text-sm text-destructive">Document does not belong to this knowledge base.</div>
  }

  const chunks = data.chunks ?? []
  const targetId =
    chunkId ??
    (chunkIndex
      ? chunks.find((c) => c.chunk_index !== null && String(c.chunk_index) === chunkIndex)?.id ?? null
      : null)

  return (
    <DocumentDetailClient
      kbId={kbId}
      doc={data.document}
      chunks={chunks}
      targetId={targetId}
    />
  )
}

