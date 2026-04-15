"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatSettingsPanel } from "@/components/chat/chat-settings-panel";
import { useRagChat } from "@/hooks/use-rag-chat";
import { useKBs } from "@/hooks/use-knowledge-bases";
import { cn } from "@/lib/utils";

function roleLabel(role: string) {
  if (role === "user") return "You";
  if (role === "assistant") return "AI";
  return role;
}

function messageToText(message: unknown): string {
  if (typeof message === "object" && message !== null) {
    const maybeContent = (message as Record<string, unknown>).content;
    if (typeof maybeContent === "string") return maybeContent;
  }

  const parts =
    typeof message === "object" && message !== null && Array.isArray((message as Record<string, unknown>).parts)
      ? ((message as Record<string, unknown>).parts as unknown[])
      : [];

  const text = parts
    .filter((p) => typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "text")
    .map((p) => ((p as Record<string, unknown>).text as string | undefined) ?? "")
    .join("");
  return text || "";
}

export function ChatThread(props: {
  conversationId: string;
  initialMessages: { id: string; role: "system" | "user" | "assistant"; content: string }[];
  initialKbIds?: string[];
  autoSendText?: string | null;
  draftId?: string | null;
}) {
  const router = useRouter();
  const [kbIds, setKbIds] = useState<string[]>(props.initialKbIds ?? []);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: kbs } = useKBs();

  const selectedKbItems = useMemo(() => {
    const list = kbs ?? [];
    if (!kbIds.length) return [];
    if (!list.length) return kbIds.map((id) => ({ id, name: id }));
    const byId = new Map(list.map((kb) => [kb.id, kb.name] as const));
    return kbIds.map((id) => ({ id, name: byId.get(id) ?? id }));
  }, [kbs, kbIds]);

  // Remount this hook when conversation changes to ensure history resets.
  const { messages, sendText, status } = useRagChat({
    conversationId: props.conversationId,
    kbIds,
    initialMessages: props.initialMessages,
  });

  const rendered = useMemo(() => messages, [messages]);
  const isLoading = status === "streaming" || status === "submitted";
  const hasAutoSentRef = useRef(false);
  const lastPersistedKbIdsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!props.conversationId || props.conversationId === "__draft__") return;
    const key = kbIds.slice().sort().join(",");
    if (lastPersistedKbIdsRef.current === key) return;
    lastPersistedKbIdsRef.current = key;
    void fetch(`/api/conversations/${encodeURIComponent(props.conversationId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kb_ids: kbIds }),
    }).catch(() => {
      // best-effort; chat still works even if persistence fails
    });
  }, [kbIds, props.conversationId]);

  useEffect(() => {
    if (hasAutoSentRef.current) return;
    const text = props.autoSendText?.trim();
    if (!text) return;
    // Only auto-send when the thread is empty (avoid duplicating on refresh).
    if ((rendered?.length ?? 0) > 0) return;
    hasAutoSentRef.current = true;
    void sendText(text);
  }, [props.autoSendText, rendered?.length, sendText]);

  const showWelcome = rendered.length === 0;

  async function createConversationFromDraft(firstText: string, selectedKbIds: string[]) {
    const titleBase = firstText.trim() || "New conversation";
    const title = titleBase.length > 60 ? `${titleBase.slice(0, 60)}…` : titleBase;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, kb_ids: selectedKbIds }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(err?.error ?? (await res.text()));
    }
    const json = (await res.json()) as { data: { id: string } };
    const id = json.data.id;
    if (props.draftId) {
      window.dispatchEvent(
        new CustomEvent("draft:converted", { detail: { draftId: props.draftId, conversationId: id } })
      );
    }
    const qp = new URLSearchParams();
    qp.set("prompt", firstText);
    if (selectedKbIds.length) qp.set("kb_ids", selectedKbIds.join(","));
    router.replace(`/c/${id}?${qp.toString()}`);
  }

  return (
    <div className="flex h-[calc(100svh-1rem)] w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b p-4">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">Chat</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">KBs</span>
                {selectedKbItems.length ? (
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {selectedKbItems.map((kb) => (
                      <span
                        key={kb.id}
                        className="inline-flex max-w-[18rem] items-center gap-1 rounded-md border bg-muted/30 px-2 py-0.5 font-medium text-foreground"
                        title={kb.name}
                      >
                        <span className="min-w-0 truncate">{kb.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="-mr-1"
                          aria-label={`Remove ${kb.name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setKbIds((prev) => prev.filter((x) => x !== kb.id));
                          }}
                        >
                          <XIcon />
                        </Button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Selected: {kbIds.length}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {showWelcome ? (
              <div className="rounded-xl border bg-muted/20 p-5">
                <div className="text-sm font-medium">欢迎来到知识库对话</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  选择右侧知识库后，直接提问；我会优先基于你选择的知识库回答。
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "总结一下这个知识库的核心内容",
                    "根据知识库给出一个执行清单/步骤",
                    "我有一个问题：……（请用知识库回答并引用要点）",
                  ].map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

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
              // Draft mode: only create conversation on first submit; do not write to DB before that.
              if (props.conversationId === "__draft__") {
                void createConversationFromDraft(text, kbIds).catch((err) => {
                  toast.error("Could not create conversation", {
                    description: err instanceof Error ? err.message : String(err),
                  });
                });
                return;
              }

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
              <div className="text-xs text-muted-foreground">Streaming enabled</div>
              <Button type="submit" disabled={isLoading || input.trim().length === 0}>
                Send
              </Button>
            </div>
          </form>
        </div>
      </div>

      <ChatSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        kbIds={kbIds}
        onKbIdsChange={setKbIds}
      />
    </div>
  );
}

