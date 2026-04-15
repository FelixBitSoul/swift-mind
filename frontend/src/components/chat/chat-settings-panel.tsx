"use client";

import { useMemo } from "react";
import { SettingsIcon, PanelRightCloseIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useKBs } from "@/hooks/use-knowledge-bases";

export function ChatSettingsPanel(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kbIds: string[];
  onKbIdsChange: (next: string[]) => void;
}) {
  const { data, isLoading } = useKBs();
  const selected = useMemo(() => new Set(props.kbIds), [props.kbIds]);
  const kbs = data ?? [];

  const selectedNames = useMemo(() => {
    if (!kbs.length) return [];
    const byId = new Map(kbs.map((kb) => [kb.id, kb.name] as const));
    return props.kbIds.map((id) => byId.get(id)).filter((x): x is string => Boolean(x));
  }, [kbs, props.kbIds]);

  return (
    <aside
      aria-label="Chat settings"
      className={cn(
        "shrink-0 overflow-hidden border-l bg-background transition-[width] duration-200 ease-out",
        props.open ? "w-[22rem]" : "w-12"
      )}
    >
      <div className={cn("flex h-full flex-col", props.open ? "w-[22rem]" : "w-12")}>
        {props.open ? (
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SettingsIcon className="size-4" />
              Settings
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Collapse settings"
              onClick={() => props.onOpenChange(false)}
            >
              <PanelRightCloseIcon />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open settings"
              onClick={() => props.onOpenChange(true)}
            >
              <SettingsIcon />
            </Button>
          </div>
        )}

        <div className={cn("flex min-h-0 flex-1 flex-col gap-4 p-4", !props.open && "hidden")}>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Knowledge bases</div>

            {isLoading ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : kbs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No knowledge bases yet.</div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-hidden transition-colors hover:bg-muted",
                    "focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  aria-label="Select knowledge bases"
                >
                  <div className="min-w-0 flex-1 truncate text-left">
                    {selectedNames.length === 0 ? (
                      <span className="text-muted-foreground">Select knowledge bases…</span>
                    ) : (
                      <span className="truncate">{selectedNames.join(", ")}</span>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {props.kbIds.length}
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className="w-[22rem]"
                >
                  <DropdownMenuLabel>Choose knowledge bases</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="max-h-[18rem]">
                    <div className="p-1">
                      {kbs.map((kb) => {
                        const checked = selected.has(kb.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={kb.id}
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              const isOn = nextChecked === true;
                              const next = new Set(props.kbIds);
                              if (isOn) next.add(kb.id);
                              else next.delete(kb.id);
                              props.onKbIdsChange(Array.from(next));
                            }}
                          >
                            <span className="truncate">{kb.name}</span>
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="text-xs text-muted-foreground">
              Selected: {props.kbIds.length}
            </div>
          </div>

          {/* Future settings can be added here as additional sections. */}
        </div>
      </div>
    </aside>
  );
}

