"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Conversation, useConversations } from "@/hooks/use-conversations";

export function AppSidebar() {
  const pathname = usePathname();
  const { data, isLoading } = useConversations();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="px-2 py-1 text-sm font-semibold tracking-tight">History</div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Knowledge</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/knowledge-bases" />}
                  isActive={pathname === "/knowledge-bases"}
                  tooltip="Knowledge Bases"
                >
                  <span>Knowledge Bases</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100svh-8rem)]">
              <SidebarMenu>
                {isLoading ? (
                  <>
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSkeleton showIcon />
                  </>
                ) : (
                  (data ?? []).map((c: Conversation) => {
                    const href = `/c/${c.id}`;
                    const active = pathname === href;
                    return (
                      <SidebarMenuItem key={c.id}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          isActive={active}
                          tooltip={c.title ?? "Untitled"}
                        >
                          <span>{c.title ?? "Untitled"}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

