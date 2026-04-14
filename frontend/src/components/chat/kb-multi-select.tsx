"use client";

import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useKBs } from "@/hooks/use-knowledge-bases";

export function KnowledgeBaseMultiSelect(props: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { data, isLoading } = useKBs();

  const selected = useMemo(() => new Set(props.value), [props.value]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading knowledge bases…</div>;
  }

  const kbs = data ?? [];
  if (kbs.length === 0) {
    return <div className="text-sm text-muted-foreground">No knowledge bases yet.</div>;
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex flex-wrap gap-3 py-1">
        {kbs.map((kb) => {
          const checked = selected.has(kb.id);
          return (
            <label
              key={kb.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => {
                  const isOn = v === true;
                  const next = new Set(props.value);
                  if (isOn) next.add(kb.id);
                  else next.delete(kb.id);
                  props.onChange(Array.from(next));
                }}
              />
              <span className="max-w-[18rem] truncate">{kb.name}</span>
            </label>
          );
        })}
      </div>
    </ScrollArea>
  );
}

