"use client";

import { cn } from "@/lib/utils";

function SwiftMindMark(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SwiftMind"
      className={cn("size-5 text-sidebar-foreground", props.className)}
    >
      <path
        d="M4.25 14.2c3.9-5.9 10.2-8.6 15.5-8.4c-3.35 1.35-6.15 3.95-7.9 7.1c1.95-.95 4.1-1.45 6.35-1.45c-1.85 4.05-6.1 7.35-11.9 7.35c-0.85 0-1.7-.07-2.55-.2c1.45-1.25 2.75-2.75 3.85-4.45c-1.1.7-2.25 1.27-3.35 1.7z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Brand(props: { className?: string; subtitle?: string | null }) {
  return (
    <div className={cn("flex items-center gap-2 px-2 py-1", props.className)}>
      <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-accent/40 text-sidebar-foreground">
        <SwiftMindMark />
      </div>

      <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
        <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">SwiftMind</div>
        {props.subtitle ? (
          <div className="truncate text-[11px] text-sidebar-foreground/70">{props.subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

