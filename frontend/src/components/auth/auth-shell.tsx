import Link from "next/link";
import type { ReactNode } from "react";

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
      className={props.className}
    >
      <path
        d="M4.25 14.2c3.9-5.9 10.2-8.6 15.5-8.4c-3.35 1.35-6.15 3.95-7.9 7.1c1.95-.95 4.1-1.45 6.35-1.45c-1.85 4.05-6.1 7.35-11.9 7.35c-0.85 0-1.7-.07-2.55-.2c1.45-1.25 2.75-2.75 3.85-4.45c-1.1.7-2.25 1.27-3.35 1.7z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AuthShell(props: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-background to-accent/12 dark:from-primary/18 dark:to-accent/18" />
        <div className="absolute -top-32 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl dark:bg-primary/10" />
        <div className="absolute -bottom-40 right-[-10rem] size-[40rem] rounded-full bg-accent/14 blur-3xl dark:bg-accent/10" />
      </div>

      <div className="relative z-10 flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-foreground/90 ring-1 ring-border/70 backdrop-blur-sm transition hover:bg-background/40"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/20">
                <SwiftMindMark className="size-5" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold tracking-tight text-foreground">SwiftMind</span>
                {props.subtitle ? (
                  <span className="block text-[11px] text-muted-foreground">{props.subtitle}</span>
                ) : null}
              </span>
            </Link>
          </div>

          {props.children}
        </div>
      </div>
    </div>
  );
}

