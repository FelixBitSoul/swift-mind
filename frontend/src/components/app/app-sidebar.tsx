"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationSidebarItem } from "@/components/app/conversation-sidebar-item";
import { DraftConversationSidebarItem, type DraftConversation } from "@/components/app/draft-conversation-sidebar-item";
import { type Conversation, useConversations } from "@/hooks/use-conversations";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useConversations();
  const [creating, setCreating] = useState(false);
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [isNavigating, startNavigating] = useTransition();
  const [drafts, setDrafts] = useState<DraftConversation[]>([]);

  useEffect(() => {
    if (optimisticHref && pathname === optimisticHref) {
      setOptimisticHref(null);
    }
  }, [optimisticHref, pathname]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ draftId?: string }>;
      const draftId = ce.detail?.draftId;
      if (!draftId) return;
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };
    window.addEventListener("draft:converted", handler);
    return () => window.removeEventListener("draft:converted", handler);
  }, [queryClient]);

  const navigateConversation = useCallback(
    (href: string) => {
      setOptimisticHref(href);
      startNavigating(() => {
        router.push(href);
      });
    },
    [router]
  );

  const createConversation = useCallback(async () => {
    // Draft UX: if user is already on a new/draft conversation page, keep it.
    if (pathname.startsWith("/c/new")) return;
    setCreating(true);
    try {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const draft: DraftConversation = { id, title: "New conversation" };
      setDrafts((prev) => [draft, ...prev]);
      navigateConversation(`/c/new?draft=${encodeURIComponent(id)}`);
    } catch (e) {
      toast.error("Could not create conversation", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(false);
    }
  }, [navigateConversation, pathname]);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="px-2 py-1 text-sm font-semibold tracking-tight">History</div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SidebarGroup className="flex min-h-0 flex-1 flex-col">
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupAction
            type="button"
            aria-label="New conversation"
            title="New conversation"
            disabled={creating}
            onClick={() => void createConversation()}
          >
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent className="min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(100svh-10rem)] min-h-0">
              <SidebarMenu>
                {isLoading ? (
                  <>
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSkeleton showIcon />
                  </>
                ) : (
                  <>
                    {drafts.map((d) => (
                      <DraftConversationSidebarItem
                        key={`draft-${d.id}`}
                        draft={d}
                        optimisticHref={optimisticHref}
                        onNavigate={navigateConversation}
                        navigating={isNavigating}
                      />
                    ))}
                    {(data ?? []).map((c: Conversation) => (
                      <ConversationSidebarItem
                        key={c.id}
                        conversation={c}
                        optimisticHref={optimisticHref}
                        onNavigate={navigateConversation}
                        navigating={isNavigating}
                      />
                    ))}
                  </>
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="shrink-0 rounded-lg p-2 transition-colors duration-200 ease-out hover:bg-sidebar-accent/55 active:bg-sidebar-accent/70">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/knowledge-bases" />}
                isActive={
                  pathname === "/knowledge-bases" ||
                  pathname.startsWith("/knowledge-bases/")
                }
                tooltip="Knowledge Bases"
              >
                <span>Knowledge Bases</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

