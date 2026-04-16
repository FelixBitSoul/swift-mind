import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DocumentChunksClient } from "./chunks-client"
import { headers } from "next/headers"

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

  const res = await fetch(`${origin}/api/documents/${encodeURIComponent(docId)}`, {
    method: "GET",
    cache: "no-store",
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
    <div className="mx-auto w-full px-4 py-6 md:max-w-3xl lg:max-w-[52rem]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">Document</div>
          <div className="mt-1 truncate text-lg font-semibold">{data.document.title}</div>
          {data.document.source ? (
            <div className="mt-1 truncate text-xs text-muted-foreground">Source: {data.document.source}</div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            window.history.back()
          }}
        >
          Back
        </Button>
      </div>

      <div className="mt-6 rounded-xl border">
        <div className="border-b px-4 py-3 text-sm font-medium">Chunks</div>
        <div className="divide-y">
          <DocumentChunksClient targetId={targetId} />
          {chunks.map((c) => {
            const active = targetId === c.id
            const label =
              c.chunk_index !== null && Number.isFinite(c.chunk_index) ? `#${c.chunk_index}` : c.id.slice(0, 8)
            return (
              <div
                key={c.id}
                id={`chunk-${c.id}`}
                className={cn("px-4 py-3 text-sm leading-6", active && "bg-muted/30")}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-muted-foreground">Chunk {label}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(c.id).catch(() => {})
                    }}
                  >
                    Copy chunk_id
                  </Button>
                </div>
                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{c.content}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

