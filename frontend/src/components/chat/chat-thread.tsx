"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KnowledgeBaseMultiSelect } from "@/components/chat/kb-multi-select";
import { useRagChat } from "@/hooks/use-rag-chat";
import { cn } from "@/lib/utils";

function roleLabel(role: string) {
  if (role === "user") return "You";
  if (role === "assistant") return "AI";
  return role;
}

function messageToText(message: any): string {
  if (typeof message?.content === "string") return message.content;
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  const text = parts
    .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
    .map((p: any) => p.text)
    .join("");
  return text || "";
}

export function ChatThread(props: {
  conversationId: string;
  initialMessages: { id: string; role: "system" | "user" | "assistant"; content: string }[];
}) {
  const [kbIds, setKbIds] = useState<string[]>([]);
  const [input, setInput] = useState("");

  // Remount this hook when conversation changes to ensure history resets.
  const { messages, sendText, status } = useRagChat({
    conversationId: props.conversationId,
    kbIds,
    initialMessages: props.initialMessages,
  });

  const rendered = useMemo(() => messages, [messages]);
  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-[calc(100svh-1rem)] flex-col">
      <div className="border-b p-4">
        <div className="mb-2 text-sm font-medium">Knowledge bases</div>
        <KnowledgeBaseMultiSelect value={kbIds} onChange={setKbIds} />
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {rendered.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg border p-3",
                m.role === "user" ? "bg-muted/50" : "bg-background"
              )}
            >
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {roleLabel(m.role)}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-6">{messageToText(m)}</div>
            </div>
          ))}

          {isLoading ? (
            <div className="text-sm text-muted-foreground">AI is typing…</div>
          ) : null}
        </div>
      </div>

      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text || isLoading) return;
            void sendText(text);
            setInput("");
          }}
          className="mx-auto flex w-full max-w-3xl flex-col gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something…"
            className="min-h-[96px] resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Streaming enabled • Selected KBs: {kbIds.length}
            </div>
            <Button type="submit" disabled={isLoading || input.trim().length === 0}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

