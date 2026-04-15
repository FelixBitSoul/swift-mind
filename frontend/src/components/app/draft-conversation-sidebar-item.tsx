"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type DraftConversation = {
  id: string;
  title: string;
};

export function DraftConversationSidebarItem(props: {
  draft: DraftConversation;
  optimisticHref?: string | null;
  onNavigate?: (href: string) => void;
  navigating?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const href = `/c/new?draft=${encodeURIComponent(props.draft.id)}`;

  const active = pathname === "/c/new" || pathname === href || props.optimisticHref === href;
  const shouldOptimisticNavigate = Boolean(props.onNavigate);

  const hasPrefetchedRef = useRef(false);
  const prefetchOnce = useCallback(() => {
    if (!shouldOptimisticNavigate) return;
    if (hasPrefetchedRef.current) return;
    hasPrefetchedRef.current = true;
    router.prefetch(href);
  }, [href, router, shouldOptimisticNavigate]);

  const handleNavigate = useCallback(
    (e: React.MouseEvent) => {
      if (!props.onNavigate) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      props.onNavigate(href);
    },
    [href, props]
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={href} />}
        isActive={active}
        tooltip={props.draft.title}
        className={cn(
          "rounded-full pr-3 transition-colors",
          active
            ? "bg-primary/15 font-medium text-primary shadow-none hover:bg-primary/20 hover:text-primary data-active:bg-primary/15 data-active:text-primary"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
        )}
        onClick={handleNavigate}
        onMouseEnter={prefetchOnce}
        onFocus={prefetchOnce}
        aria-disabled={props.navigating && !active}
      >
        <span className="truncate">{props.draft.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

