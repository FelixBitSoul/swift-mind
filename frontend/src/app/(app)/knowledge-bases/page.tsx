"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { FolderIcon, MessageCircleIcon, PlusIcon, TrashIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useCreateKB, useDeleteKB, useKBs, useUpdateKB } from "@/hooks/use-knowledge-bases"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Max 200 chars"),
  description: z.string().max(2000, "Max 2000 chars").optional(),
})

type CreateValues = z.infer<typeof createSchema>

export default function KnowledgeBasesPage() {
  const router = useRouter()
  const kbsQuery = useKBs()
  const createMutation = useCreateKB()
  const deleteMutation = useDeleteKB()
  const updateMutation = useUpdateKB()

  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [editingDescId, setEditingDescId] = useState<string | null>(null)
  const [editingDesc, setEditingDesc] = useState("")
  const descRef = useRef<HTMLTextAreaElement | null>(null)
  const [deleteConfirmForId, setDeleteConfirmForId] = useState<string | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "" },
  })

  const sorted = useMemo(() => {
    const data = kbsQuery.data ?? []
    return [...data].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }, [kbsQuery.data])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 sm:items-center">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Knowledge Bases</div>
          <div className="text-sm text-muted-foreground">Create, view, and delete your knowledge bases.</div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create knowledge base</DialogTitle>
              <DialogDescription>Name is required. Description is optional.</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(async (values) => {
                  try {
                    await createMutation.mutateAsync({
                      name: values.name,
                      description: values.description?.trim() ? values.description.trim() : undefined,
                    })
                    toast.success("Knowledge base created")
                    form.reset({ name: "", description: "" })
                    setCreateOpen(false)
                  } catch (e) {
                    toast.error("Create failed", { description: e instanceof Error ? e.message : String(e) })
                  }
                })}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Product docs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Optional" rows={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={createMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {kbsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : kbsQuery.isError ? (
        <div className="text-sm text-destructive">Failed to load: {String(kbsQuery.error)}</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No knowledge bases</CardTitle>
            <CardDescription>Create one to start ingesting documents.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((kb) => (
            (() => {
              const isDeleteDialogOpen = deleteConfirmForId === kb.id
              const matchesName = deleteConfirmText.trim() === kb.name.trim()

              return (
            <Card
              key={kb.id}
              role="link"
              tabIndex={0}
              aria-label={`Open knowledge base ${kb.name}`}
              className={cn(
                "transition-colors",
                "cursor-pointer hover:bg-muted/30"
              )}
              onClick={(e) => {
                // Only navigate when clicking on non-interactive blank areas.
                const target = e.target as HTMLElement | null
                if (target?.closest('a,button,input,textarea,select,[role="button"],[data-no-card-nav]')) return
                router.push(`/knowledge-bases/${encodeURIComponent(kb.id)}`)
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return
                const target = e.target as HTMLElement | null
                if (target?.closest('a,button,input,textarea,select,[role="button"],[data-no-card-nav]')) return
                e.preventDefault()
                router.push(`/knowledge-bases/${encodeURIComponent(kb.id)}`)
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="min-w-0 flex-1">

                {editingId === kb.id ? (
                  <Input
                    ref={inputRef}
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Escape") {
                        e.preventDefault()
                        setEditingId(null)
                        setEditingName("")
                        return
                      }
                      if (e.key !== "Enter") return

                      e.preventDefault()
                      const nextName = editingName.trim()
                      if (!nextName) {
                        toast.error("Name is required")
                        return
                      }
                      if (nextName === kb.name) {
                        setEditingId(null)
                        setEditingName("")
                        return
                      }
                      try {
                        await updateMutation.mutateAsync({ kbId: kb.id, name: nextName })
                        toast.success("Saved")
                        setEditingId(null)
                        setEditingName("")
                      } catch (err) {
                        toast.error("Save failed", { description: err instanceof Error ? err.message : String(err) })
                      }
                    }}
                    onBlur={() => {
                      // Requirement: save on Enter; blur cancels edit.
                      setEditingId(null)
                      setEditingName("")
                    }}
                    disabled={updateMutation.isPending}
                    aria-label="Edit knowledge base name"
                  />
                ) : (
                  <CardTitle
                    className="truncate cursor-text"
                    title="Click to rename"
                    role="button"
                    tabIndex={0}
                    data-no-card-nav
                    onClick={() => {
                      setEditingId(kb.id)
                      setEditingName(kb.name)
                      queueMicrotask(() => inputRef.current?.select())
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return
                      e.preventDefault()
                      setEditingId(kb.id)
                      setEditingName(kb.name)
                      queueMicrotask(() => inputRef.current?.select())
                    }}
                  >
                    {kb.name}
                  </CardTitle>
                )}
                </div>

                <div className="flex flex-col items-center gap-1 self-center">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          aria-label="Chat with this knowledge base"
                          href={`/c/new?kb_ids=${encodeURIComponent(kb.id)}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                        >
                          <MessageCircleIcon />
                        </Link>
                      }
                    />
                    <TooltipContent>Chat</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          aria-label="Manage documents"
                          href={`/knowledge-bases/${kb.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                        >
                          <FolderIcon />
                        </Link>
                      }
                    />
                    <TooltipContent>Manage docs</TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {editingDescId === kb.id ? (
                  <Textarea
                    ref={descRef}
                    value={editingDesc}
                    autoFocus
                    rows={3}
                    onChange={(e) => setEditingDesc(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Escape") {
                        e.preventDefault()
                        setEditingDescId(null)
                        setEditingDesc("")
                        return
                      }
                      if (e.key !== "Enter" || e.shiftKey) return
                      e.preventDefault()
                      const next = editingDesc.trim()
                      const prev = kb.description?.trim() ?? ""
                      if (next === prev) {
                        setEditingDescId(null)
                        setEditingDesc("")
                        return
                      }
                      try {
                        await updateMutation.mutateAsync({
                          kbId: kb.id,
                          description: next ? next : null,
                        })
                        toast.success("Saved")
                        setEditingDescId(null)
                        setEditingDesc("")
                      } catch (err) {
                        toast.error("Save failed", { description: err instanceof Error ? err.message : String(err) })
                      }
                    }}
                    onBlur={() => {
                      // Keep consistent with name: save on Enter; blur cancels edit.
                      setEditingDescId(null)
                      setEditingDesc("")
                    }}
                    disabled={updateMutation.isPending}
                    aria-label="Edit knowledge base description"
                  />
                ) : (
                  <CardDescription
                    className="line-clamp-3 cursor-text"
                    title="Click to edit description"
                    role="button"
                    tabIndex={0}
                    data-no-card-nav
                    onClick={() => {
                      setEditingDescId(kb.id)
                      setEditingDesc(kb.description ?? "")
                      queueMicrotask(() => descRef.current?.select())
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return
                      e.preventDefault()
                      setEditingDescId(kb.id)
                      setEditingDesc(kb.description ?? "")
                      queueMicrotask(() => descRef.current?.select())
                    }}
                  >
                    {kb.description?.trim() ? kb.description : "No description"}
                  </CardDescription>
                )}
              </CardContent>
              <CardFooter className="items-end justify-between">
                <div className="text-xs text-muted-foreground">
                  <div>Created: {new Date(kb.created_at).toLocaleString()}</div>
                  <div>Updated: {new Date(kb.updated_at).toLocaleString()}</div>
                </div>
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <AlertDialogTrigger
                          asChild
                          onClick={() => {
                            setDeleteConfirmForId(kb.id)
                            setDeleteConfirmText("")
                          }}
                        >
                          <Button variant="ghost" size="icon-sm" aria-label="Delete">
                            <TrashIcon />
                          </Button>
                        </AlertDialogTrigger>
                      }
                    />
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>

                  <AlertDialogContent
                    onEscapeKeyDown={() => {
                      setDeleteConfirmForId(null)
                      setDeleteConfirmText("")
                    }}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete knowledge base?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the knowledge base and associated documents/chunks.
                        <div className="mt-4 space-y-3">
                          <div className="text-sm font-medium">
                            Type <span className="font-semibold text-destructive">{kb.name}</span> to confirm.
                          </div>
                          <Input
                            value={isDeleteDialogOpen ? deleteConfirmText : ""}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={kb.name}
                            autoFocus
                            disabled={deleteMutation.isPending}
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-5">
                      <AlertDialogCancel
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          setDeleteConfirmForId(null)
                          setDeleteConfirmText("")
                        }}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteMutation.isPending || !matchesName}
                        onClick={async () => {
                          try {
                            await deleteMutation.mutateAsync(kb.id)
                            toast.success("Deleted")
                            setDeleteConfirmForId(null)
                            setDeleteConfirmText("")
                          } catch (e) {
                            toast.error("Delete failed", {
                              description: e instanceof Error ? e.message : String(e),
                            })
                          }
                        }}
                      >
                        {deleteMutation.isPending ? "Deleting…" : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
              )
            })()
          ))}
        </div>
      )}
    </div>
  )
}

