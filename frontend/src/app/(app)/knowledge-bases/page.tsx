"use client"

import { useMemo, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { PlusIcon, TrashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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
import { useCreateKB, useDeleteKB, useKBs } from "@/hooks/use-knowledge-bases"

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Max 200 chars"),
  description: z.string().max(2000, "Max 2000 chars").optional(),
})

type CreateValues = z.infer<typeof createSchema>

export default function KnowledgeBasesPage() {
  const kbsQuery = useKBs()
  const createMutation = useCreateKB()
  const deleteMutation = useDeleteKB()

  const [createOpen, setCreateOpen] = useState(false)

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
      <div className="flex items-start justify-between gap-4">
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
            <Card key={kb.id}>
              <CardHeader className="border-b">
                <CardTitle className="truncate">{kb.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {kb.description?.trim() ? kb.description : "No description"}
                </CardDescription>
                <CardAction>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete">
                        <TrashIcon />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete knowledge base?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the knowledge base and associated documents/chunks.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deleteMutation.isPending}
                          onClick={async () => {
                            try {
                              await deleteMutation.mutateAsync(kb.id)
                              toast.success("Deleted")
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
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <div>Created: {new Date(kb.created_at).toLocaleString()}</div>
                <div>Updated: {new Date(kb.updated_at).toLocaleString()}</div>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="outline" size="sm" disabled>
                  Manage docs (soon)
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

