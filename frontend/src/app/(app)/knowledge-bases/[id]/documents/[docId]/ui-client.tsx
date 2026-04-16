"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DocumentChunksClient } from "./chunks-client"

type DocChunk = {
  id: string
  kb_id: string
  doc_id: string
  chunk_index: number | null
  content: string
}

type DocumentRow = {
  id: string
  kb_id: string
  title: string
  source: string | null
  mime_type: string | null
  status: string
  created_at: string
  updated_at: string
}

export function DocumentDetailClient(props: {
  kbId: string
  doc: DocumentRow
  chunks: DocChunk[]
  targetId: string | null
}) {
  return (
    <div className="mx-auto w-full px-4 py-6 md:max-w-3xl lg:max-w-[52rem]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">Document</div>
          <div className="mt-1 truncate text-lg font-semibold">{props.doc.title}</div>
          {props.doc.source ? (
            <div className="mt-1 truncate text-xs text-muted-foreground">Source: {props.doc.source}</div>
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
          <DocumentChunksClient targetId={props.targetId} />
          {props.chunks.map((c) => {
            const active = props.targetId === c.id
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

