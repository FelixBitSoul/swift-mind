"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MinusIcon,
  XIcon,
  RefreshCwIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

function statusLabel(status: string) {
  if (status === "processing") return "Processing"
  if (status === "ready") return "Ready"
  if (status === "failed") return "Failed"
  if (status === "uploaded") return "Uploaded"
  return status
}

function fileExtFromTitle(title: string) {
  const base = title.split("/").pop() ?? title
  const idx = base.lastIndexOf(".")
  if (idx <= 0 || idx === base.length - 1) return ""
  return base.slice(idx + 1).toLowerCase()
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"] as const
  let v = bytes / 1024
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[u]}`
}

function HeaderSelectCheckbox(props: {
  allChecked: boolean
  mixed: boolean
  onToggle: () => void
}) {
  const { allChecked, mixed, onToggle } = props
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        allChecked ? "border-primary bg-primary text-primary-foreground" : "bg-background"
      )}
      role="checkbox"
      aria-checked={mixed ? "mixed" : allChecked}
      aria-label="Select all on page"
    >
      {mixed ? <MinusIcon className="size-3.5" /> : allChecked ? <CheckIcon className="size-3.5" /> : null}
    </button>
  )
}

export default function KnowledgeBaseDetailPage() {
  const params = useParams<{ id: string }>()
  const kbId = params.id

  const docsQuery = useKBDocuments(kbId)
  const deleteDoc = useDeleteDocument({ kbId })
  const uploadDocs = useUploadKBDocuments({ kbId })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [polling, setPolling] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<"updated_desc" | "created_desc" | "title_asc">("updated_desc")
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data])
  const hasProcessing = useMemo(
    () => docs.some((d) => d.status === "processing"),
    [docs]
  )

  useEffect(() => {
    if (!selectedId) return
    if (docs.some((d) => d.id === selectedId)) return
    setSelectedId(null)
  }, [docs, selectedId])

  // Simple polling while there are processing documents.
  useEffect(() => {
    if (!polling || !hasProcessing) return
    const t = setInterval(() => {
      void docsQuery.refetch()
    }, 2500)
    return () => clearInterval(t)
  }, [polling, hasProcessing, docsQuery])

  const statusOptions = useMemo(() => {
    const s = new Set<string>()
    for (const d of docs) s.add(d.status)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [docs])

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byStatus = statusFilter

    const filtered = docs.filter((d) => {
      if (q && !d.title.toLowerCase().includes(q) && !(d.source ?? "").toLowerCase().includes(q)) return false
      if (byStatus.size && !byStatus.has(d.status)) return false
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "title_asc") return a.title.localeCompare(b.title)
      if (sortBy === "created_desc") return a.created_at < b.created_at ? 1 : -1
      return a.updated_at < b.updated_at ? 1 : -1
    })

    return sorted
  }, [docs, query, statusFilter, sortBy])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredSorted.length / pageSize))
  }, [filteredSorted.length, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
    if (page < 1) setPage(1)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredSorted.slice(start, start + pageSize)
  }, [filteredSorted, page, pageSize])

  const selectedCount = useMemo(() => {
    let c = 0
    for (const id of Object.keys(selectedIds)) if (selectedIds[id]) c++
    return c
  }, [selectedIds])

  const allVisibleChecked = useMemo(() => {
    if (pageItems.length === 0) return false
    return pageItems.every((d) => selectedIds[d.id])
  }, [pageItems, selectedIds])

  const someVisibleChecked = useMemo(() => {
    if (pageItems.length === 0) return false
    return pageItems.some((d) => selectedIds[d.id]) && !allVisibleChecked
  }, [pageItems, selectedIds, allVisibleChecked])

  const selectedDoc = useMemo(() => {
    if (!selectedId) return null
    return docs.find((d) => d.id === selectedId) ?? null
  }, [docs, selectedId])

  const rangeLabel = useMemo(() => {
    if (filteredSorted.length === 0) return "0"
    const start = (page - 1) * pageSize + 1
    const end = Math.min(filteredSorted.length, page * pageSize)
    return `${start}-${end} / ${filteredSorted.length}`
  }, [filteredSorted.length, page, pageSize])

  const activeFilterCount = useMemo(() => {
    let c = 0
    if (query.trim()) c++
    if (statusFilter.size) c++
    return c
  }, [query, statusFilter.size])

  async function bulkDeleteSelected() {
    const ids = Object.keys(selectedIds).filter((id) => selectedIds[id])
    if (!ids.length) return
    const results = await Promise.allSettled(ids.map((id) => deleteDoc.mutateAsync(id)))
    const ok = results.filter((r) => r.status === "fulfilled").length
    const failed = results.length - ok

    setSelectedIds({})
    if (selectedId && ids.includes(selectedId)) setSelectedId(null)

    if (failed === 0) toast.success(`Deleted ${ok} document${ok === 1 ? "" : "s"}`)
    else toast.error(`Deleted ${ok}, failed ${failed}`)
  }

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
      ) : docs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No documents</CardTitle>
            <CardDescription>
              Upload PDF or Markdown (.md, .markdown) files to ingest them into this knowledge base.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card className="min-w-0">
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate">Files</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{rangeLabel}</span>
                    <span className={cn(selectedCount ? "" : "text-muted-foreground")}>
                      {selectedCount ? `${selectedCount} selected` : "No selection"}
                    </span>
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setPage(1)
                    }}
                    placeholder="Search by name/source…"
                    className="h-9 w-[220px]"
                    aria-label="Search documents"
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="sm">
                          Status{statusFilter.size ? ` (${statusFilter.size})` : ""}
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusOptions.length ? (
                          statusOptions.map((s) => (
                            <DropdownMenuCheckboxItem
                              key={s}
                              checked={statusFilter.has(s)}
                              onCheckedChange={(checked) => {
                                setStatusFilter((prev) => {
                                  const next = new Set(prev)
                                  if (checked) next.add(s)
                                  else next.delete(s)
                                  return next
                                })
                                setPage(1)
                              }}
                            >
                              {statusLabel(s)}
                            </DropdownMenuCheckboxItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No statuses</div>
                        )}
                        <DropdownMenuSeparator />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            setStatusFilter(new Set())
                            setPage(1)
                          }}
                        >
                          Clear status filter
                        </Button>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="sm">
                          Sort
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={sortBy === "updated_desc"}
                          onCheckedChange={() => setSortBy("updated_desc")}
                        >
                          Updated (newest)
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={sortBy === "created_desc"}
                          onCheckedChange={() => setSortBy("created_desc")}
                        >
                          Uploaded (newest)
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={sortBy === "title_asc"}
                          onCheckedChange={() => setSortBy("title_asc")}
                        >
                          Name (A→Z)
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="sm">
                          Page: {pageSize}
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Page size</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {[10, 20, 50, 100].map((n) => (
                          <DropdownMenuCheckboxItem
                            key={n}
                            checked={pageSize === n}
                            onCheckedChange={() => {
                              setPageSize(n)
                              setPage(1)
                            }}
                          >
                            {n} / page
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {activeFilterCount ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Filters active</span>
                    {query.trim() ? <span className="rounded bg-background px-2 py-1">Query: {query.trim()}</span> : null}
                    {statusFilter.size ? (
                      <span className="rounded bg-background px-2 py-1">Status: {statusFilter.size}</span>
                    ) : null}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("")
                      setStatusFilter(new Set())
                      setPage(1)
                    }}
                  >
                    <XIcon />
                    Clear filters
                  </Button>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-[24px_minmax(0,1fr)_80px_90px_170px_170px_44px] items-center gap-2 text-xs font-medium text-muted-foreground">
                <HeaderSelectCheckbox
                  allChecked={allVisibleChecked}
                  mixed={someVisibleChecked}
                  onToggle={() => {
                    const nextChecked = !allVisibleChecked
                    setSelectedIds((prev) => {
                      const next = { ...prev }
                      for (const d of pageItems) next[d.id] = nextChecked
                      return next
                    })
                  }}
                />
                <div>Name</div>
                <div>Type</div>
                <div>Size</div>
                <div>Status</div>
                <div>Updated</div>
                <div className="text-right"> </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {pageItems.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No documents match your filters.</div>
              ) : (
                <div className="divide-y">
                  {pageItems.map((doc: KBDocument) => {
                    const isSelected = Boolean(selectedIds[doc.id])
                    const isActive = selectedId === doc.id
                    const ext = fileExtFromTitle(doc.title)
                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "group relative grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_80px_90px_170px_170px_44px] items-center gap-2 px-6 py-3 text-sm outline-none transition-colors",
                          isActive ? "bg-muted/60" : "hover:bg-muted/30"
                        )}
                        role="row"
                        onClick={() => {
                          setSelectedId(doc.id)
                          setPreviewOpen(true)
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) => ({ ...prev, [doc.id]: Boolean(checked) }))
                          }}
                          aria-label={`Select ${doc.title}`}
                        />

                        <button
                          type="button"
                          className="min-w-0 cursor-pointer text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          onClick={() => {
                            setSelectedId(doc.id)
                            setPreviewOpen(true)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSelectedId(doc.id)
                              setPreviewOpen(true)
                            }
                          }}
                        >
                          <div className="truncate font-medium">{doc.title}</div>
                          <div className="truncate text-xs text-muted-foreground">KB: {doc.kb_id}</div>
                        </button>

                        <div className="truncate text-xs text-muted-foreground">{ext ? ext.toUpperCase() : "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">{formatBytes(NaN)}</div>
                        <div className="truncate text-xs">{statusLabel(doc.status)}</div>
                        <div className="truncate text-xs text-muted-foreground">{new Date(doc.updated_at).toLocaleString()}</div>

                        <div className="flex justify-end">
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Preview document"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedId(doc.id)
                                setPreviewOpen(true)
                              }}
                            >
                              <EyeIcon />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Delete document"
                                  onClick={(e) => e.stopPropagation()}
                                >
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
                                        setSelectedIds((prev) => {
                                          const next = { ...prev }
                                          delete next[doc.id]
                                          return next
                                        })
                                        if (selectedId === doc.id) setSelectedId(null)
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
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>

            <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
              <div className="text-xs text-muted-foreground">
                Page {page} / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeftIcon />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {hasProcessing ? (
        <div className="text-sm text-muted-foreground">
          Some documents are processing. {polling ? "Auto-refreshing…" : "Use Refresh to update status."}
        </div>
      ) : null}

      <Sheet
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
        }}
      >
        <SheetContent side="right" className="w-[480px] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Preview</SheetTitle>
            <SheetDescription>
              {selectedDoc ? selectedDoc.title : "Select a document to see details."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 px-4 pb-4 text-sm">
            {selectedDoc ? (
              <>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Name</div>
                  <div className="break-words">{selectedDoc.title}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Type</div>
                    <div>{selectedDoc.mime_type ?? "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Status</div>
                    <div>{statusLabel(selectedDoc.status)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Uploaded</div>
                    <div>{new Date(selectedDoc.created_at).toLocaleString()}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Updated</div>
                    <div>{new Date(selectedDoc.updated_at).toLocaleString()}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Knowledge base</div>
                  <div className="break-words">{selectedDoc.kb_id}</div>
                </div>

                {selectedDoc.source ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Source</div>
                    <div className="break-words">{selectedDoc.source}</div>
                  </div>
                ) : null}

                {selectedDoc.bucket || selectedDoc.path ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Storage</div>
                    <div className="break-words text-xs text-muted-foreground">
                      {selectedDoc.bucket ? `Bucket: ${selectedDoc.bucket}` : null}
                      {selectedDoc.bucket && selectedDoc.path ? <span className="mx-2">•</span> : null}
                      {selectedDoc.path ? `Path: ${selectedDoc.path}` : null}
                    </div>
                  </div>
                ) : null}

                {selectedDoc.error ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Error</div>
                    <div className="break-words text-sm text-destructive">{selectedDoc.error}</div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Select a document row to open preview.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating bulk actions bar (only when selection exists) */}
      {selectedCount ? (
        <div
          className={cn(
            "fixed inset-x-0 bottom-4 z-50 flex justify-center px-4",
            "pointer-events-none"
          )}
        >
          <div
            className={cn(
              "pointer-events-auto flex w-full max-w-[760px] items-center justify-between gap-3 rounded-xl border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm",
              "transition-all duration-150",
              selectedCount ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            )}
            role="region"
            aria-label="Bulk actions"
          >
            <div className="min-w-0 text-sm">
              <span className="font-medium">{selectedCount}</span>{" "}
              <span className="text-muted-foreground">selected</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds({})}>
                Clear
              </Button>

              <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deleteDoc.isPending}>
                    <TrashIcon />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete selected documents?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {selectedCount} document{selectedCount === 1 ? "" : "s"} and their vector chunks.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteDoc.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteDoc.isPending}
                      onClick={async () => {
                        try {
                          await bulkDeleteSelected()
                        } finally {
                          setBulkDeleteOpen(false)
                        }
                      }}
                    >
                      {deleteDoc.isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

