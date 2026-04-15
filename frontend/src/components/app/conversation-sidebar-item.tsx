"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Conversation } from "@/hooks/use-conversations";

export function ConversationSidebarItem({ conversation: c }: { conversation: Conversation }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const href = `/c/${c.id}`;
  const active = pathname === href;

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openRename = useCallback(() => {
    setRenameTitle(c.title?.trim() ? c.title : "Untitled");
    setRenameOpen(true);
  }, [c.title]);

  const saveRename = useCallback(async () => {
    const title = renameTitle.trim();
    if (!title) {
      toast.error("标题不能为空");
      return;
    }
    setRenameBusy(true);
    try {
      const res = await fetch(`/api/conversations/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? (await res.text()));
      }
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("已重命名");
      setRenameOpen(false);
    } catch (e) {
      toast.error("重命名失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRenameBusy(false);
    }
  }, [c.id, queryClient, renameTitle]);

  const confirmDelete = useCallback(async () => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/conversations/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? (await res.text()));
      }
      await queryClient.refetchQueries({ queryKey: ["conversations"] });
      const list = queryClient.getQueryData<Conversation[]>(["conversations"]) ?? [];
      const next = list.find((x) => x.id !== c.id);

      if (pathname === href) {
        if (next) router.push(`/c/${next.id}`);
        else router.push("/knowledge-bases");
      }

      toast.success("已删除");
      setDeleteOpen(false);
    } catch (e) {
      toast.error("删除失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDeleteBusy(false);
    }
  }, [c.id, href, pathname, queryClient, router]);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href={href} />}
          isActive={active}
          tooltip={c.title ?? "Untitled"}
          className={cn(
            "rounded-full pr-10 transition-colors",
            active
              ? "bg-primary/15 font-medium text-primary shadow-none hover:bg-primary/20 hover:text-primary data-active:bg-primary/15 data-active:text-primary"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
          )}
        >
          <span className="truncate">{c.title ?? "Untitled"}</span>
        </SidebarMenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuAction
                showOnHover
                className={cn(
                  "top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none ring-0",
                  "peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2 peer-data-[size=sm]/menu-button:top-1/2",
                  "text-sidebar-foreground/70 transition-[background-color,color,opacity]",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "data-pressed:bg-sidebar-accent data-pressed:text-sidebar-accent-foreground",
                  "data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground",
                  "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-0 focus-visible:ring-offset-transparent",
                  "data-popup-open:opacity-100"
                )}
              />
            }
            aria-label="对话操作"
          >
            <MoreVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            alignOffset={0}
            side="right"
            sideOffset={6}
            className="min-w-[9.5rem]"
          >
            <DropdownMenuItem
              className="gap-2"
              onClick={() => {
                openRename();
              }}
            >
              <PencilIcon className="size-4" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>重命名对话</DialogTitle>
            <DialogDescription>修改后将立即在侧栏与列表中生效。</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder="对话标题"
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renameBusy}>
              取消
            </Button>
            <Button type="button" onClick={() => void saveRename()} disabled={renameBusy}>
              {renameBusy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除对话？</AlertDialogTitle>
            <AlertDialogDescription>将删除该对话及其消息记录，且无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
