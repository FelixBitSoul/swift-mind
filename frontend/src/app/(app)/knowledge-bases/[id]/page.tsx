"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeftIcon, RefreshCwIcon, TrashIcon, UploadIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { type KBDocument, useDeleteDocument, useKBDocuments, useUploadKBDocuments } from "@/hooks/use-documents"
import { cn } from "@/lib/utils"

function statusLabel(status: string) {
  if (status === "processing") return "Processing"
  if (status === "ready") return "Ready"
  if (status === "failed") return "Failed"
  if (status === "uploaded") return "Uploaded"
  return status
}

export default function KnowledgeBaseDetailPage() {
  const params = useParams<{ id: string }>()
  const kbId = params.id

  const docsQuery = useKBDocuments(kbId)
  const deleteDoc = useDeleteDocument({ kbId })
  const uploadDocs = useUploadKBDocuments({ kbId })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [polling, setPolling] = useState(true)

  const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data])
  const hasProcessing = useMemo(
    () => docs.some((d) => d.status === "processing"),
    [docs]
  )

  // Simple polling while there are processing documents.
  useEffect(() => {
    if (!polling || !hasProcessing) return
    const t = setInterval(() => {
      void docsQuery.refetch()
    }, 2500)
    return () => clearInterval(t)
  }, [polling, hasProcessing, docsQuery])

  const sorted = useMemo(() => {
    return [...docs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }, [docs])

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return
    const allowed = (f: File) => {
      const n = f.name.toLowerCase()
      return n.endsWith(".pdf") || n.endsWith(".md") || n.endsWith(".markdown")
    }
    const picked = Array.from(files).filter(allowed)
    if (!picked.length) {
      toast.error("Only PDF and Markdown (.md, .markdown) files are supported")
      return
    }
    try {
      await uploadDocs.mutateAsync(picked)
      toast.success(`Uploaded ${picked.length} file${picked.length === 1 ? "" : "s"}`)
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/knowledge-bases"
            aria-label="Back"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            <ArrowLeftIcon />
          </Link>
          <div>
            <div className="text-2xl font-semibold tracking-tight">Documents</div>
            <div className="text-sm text-muted-foreground">Knowledge base: {kbId}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf,text/markdown,.md,.markdown"
            multiple
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadDocs.isPending}
          >
            <UploadIcon />
            {uploadDocs.isPending ? "Uploading…" : "Upload files"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void docsQuery.refetch()}
            disabled={docsQuery.isFetching}
          >
            <RefreshCwIcon />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => setPolling((v) => !v)}
            aria-pressed={polling}
          >
            Polling: {polling ? "On" : "Off"}
          </Button>
        </div>
      </div>

      <Separator />

      {docsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : docsQuery.isError ? (
        <div className="text-sm text-destructive">Failed to load: {String(docsQuery.error)}</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No documents</CardTitle>
            <CardDescription>
              Upload PDF or Markdown (.md, .markdown) files to ingest them into this knowledge base.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map((doc: KBDocument) => (
            <Card key={doc.id}>
              <CardHeader className="border-b">
                <CardTitle className="truncate">{doc.title}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Status: {statusLabel(doc.status)}</span>
                  <span>Uploaded: {new Date(doc.created_at).toLocaleString()}</span>
                </CardDescription>
                <CardAction>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete document">
                        <TrashIcon />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the document and its vector chunks.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteDoc.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deleteDoc.isPending}
                          onClick={async () => {
                            try {
                              await deleteDoc.mutateAsync(doc.id)
                              toast.success("Document deleted")
                            } catch (e) {
                              toast.error("Delete failed", {
                                description: e instanceof Error ? e.message : String(e),
                              })
                            }
                          }}
                        >
                          {deleteDoc.isPending ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardAction>
              </CardHeader>

              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="truncate">Doc ID: {doc.id}</div>
                {doc.source ? <div className="truncate">Source: {doc.source}</div> : null}
                {doc.error ? <div className="text-destructive">Error: {doc.error}</div> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasProcessing ? (
        <div className="text-sm text-muted-foreground">
          Some documents are processing. {polling ? "Auto-refreshing…" : "Use Refresh to update status."}
        </div>
      ) : null}
    </div>
  )
}

