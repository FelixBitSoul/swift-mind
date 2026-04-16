"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatSettingsPanel } from "@/components/chat/chat-settings-panel";
import { MarkdownMessage } from "@/components/chat/markdown-message";
import { useRagChat } from "@/hooks/use-rag-chat";
import { useKBs } from "@/hooks/use-knowledge-bases";
import { cn } from "@/lib/utils";

type Citation = {
  kb_id: string;
  doc_id: string;
  chunk_id: string;
  chunk_index?: number;
  title?: string;
  source?: string;
  score?: number;
  snippet: string;
};

function getCitations(message: unknown): Citation[] {
  if (typeof message !== "object" || message === null) return [];
  const meta = (message as Record<string, unknown>).metadata;
  if (typeof meta !== "object" || meta === null) return [];
  const citations = (meta as Record<string, unknown>).citations;
  if (!Array.isArray(citations)) return [];
  return citations.filter((c): c is Citation => typeof c === "object" && c !== null) as Citation[];
}

function citationDeepLink(c: Citation, idx?: number) {
  const qp = new URLSearchParams();
  qp.set("chunk_id", c.chunk_id);
  if (typeof c.chunk_index === "number" && Number.isFinite(c.chunk_index)) {
    qp.set("chunk_index", String(c.chunk_index));
  }
  if (typeof idx === "number") qp.set("cite", String(idx + 1));
  return `/knowledge-bases/${encodeURIComponent(c.kb_id)}/documents/${encodeURIComponent(c.doc_id)}?${qp.toString()}`;
}

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
  const containerClass = "mx-auto w-full px-4 md:max-w-3xl lg:max-w-[40rem] xl:max-w-[48rem]";
  const [kbIds, setKbIds] = useState<string[]>(props.initialKbIds ?? []);
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: kbs } = useKBs();
  const isComposingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

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

  function scrollToBottom(opts?: { behavior?: ScrollBehavior }) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: opts?.behavior ?? "auto" });
  }

  function schedulePinnedScrollToBottom() {
    if (!isPinnedToBottom) return;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      scrollToBottom();
    });
  }

  function submitText(raw: string) {
    const text = raw.trim();
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
  }

  useEffect(() => {
    schedulePinnedScrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered.length, status]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

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
    <div className="flex h-full min-h-0 w-full">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="border-b">
          <div className={cn(containerClass, "flex items-center justify-between gap-3 py-4")}>
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

        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
            const nextPinned = distance < 80;
            setIsPinnedToBottom(nextPinned);
          }}
          className="flex-1 overflow-auto"
        >
          <div className={cn(containerClass, "flex flex-col gap-4 py-4 pb-40")}>
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
              <div key={m.id} className="flex w-full justify-end">
                <div className={cn("w-full", m.role === "user" && "max-w-[85%] sm:max-w-[75%]")}>
                  <div
                    className={cn(
                      "mb-1 text-[11px] font-medium text-muted-foreground",
                      m.role === "assistant" ? "text-left" : "text-right"
                    )}
                  >
                    {roleLabel(m.role)}
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5",
                      "break-words [overflow-wrap:anywhere]",
                      m.role === "user"
                        ? "ml-auto w-fit bg-primary text-primary-foreground"
                        : "w-full border bg-muted/20 text-foreground text-left"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="flex flex-col gap-3">
                        <MarkdownMessage content={messageToText(m)} />
                        {(() => {
                          const citations = getCitations(m);
                          if (!citations.length) return null;
                          return (
                            <div className="rounded-xl border bg-background/60 p-3">
                              <div className="text-xs font-medium text-muted-foreground">引用来源</div>
                              <div className="mt-2 flex flex-col gap-2">
                                {citations.map((c, idx) => {
                                  const title = c.title ?? c.source ?? c.doc_id;
                                  const score =
                                    typeof c.score === "number" && Number.isFinite(c.score)
                                      ? c.score.toFixed(2)
                                      : null;
                                  return (
                                    <button
                                      key={`${c.doc_id}:${c.chunk_id}:${idx}`}
                                      type="button"
                                      className={cn(
                                        "w-full rounded-lg border bg-muted/10 px-3 py-2 text-left",
                                        "hover:bg-muted/20"
                                      )}
                                      onClick={() => {
                                        window.open(citationDeepLink(c, idx), "_blank");
                                      }}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate text-xs font-medium">
                                            <span className="mr-2 text-muted-foreground">[{idx + 1}]</span>
                                            {title}
                                          </div>
                                          <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                                            {c.snippet}
                                          </div>
                                        </div>
                                        {score ? (
                                          <div className="shrink-0 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                                            {score}
                                          </div>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-3 border-t pt-3">
                                <div className="text-xs font-medium text-muted-foreground">参考</div>
                                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                                  {citations.map((c, idx) => {
                                    const title = c.title ?? c.source ?? c.doc_id;
                                    const href = citationDeepLink(c, idx);
                                    return (
                                      <li key={`ref:${c.doc_id}:${c.chunk_id}:${idx}`}>
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                          className="underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground"
                                        >
                                          {title}
                                        </a>
                                      </li>
                                    );
                                  })}
                                </ol>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-6">{messageToText(m)}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading ? (
              <div className="text-sm text-muted-foreground">AI is typing…</div>
            ) : null}
          </div>
        </div>

        {!isPinnedToBottom ? (
          <div className="pointer-events-none absolute bottom-28 left-0 right-0 z-10">
            <div className={cn(containerClass, "flex justify-center")}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="回到底部"
                className={cn(
                  "pointer-events-auto size-9 rounded-full",
                  "bg-background/80 shadow-md shadow-black/10 backdrop-blur-xl",
                  "supports-[backdrop-filter]:bg-background/70 dark:supports-[backdrop-filter]:bg-background/40"
                )}
                onClick={() => {
                  setIsPinnedToBottom(true);
                  scrollToBottom({ behavior: "smooth" });
                }}
              >
                <ArrowDownIcon className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-10">
          <div className={containerClass}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitText(input);
              }}
              className="pointer-events-auto"
            >
              <div
                className={cn(
                  "rounded-2xl border border-border/60 bg-background/85 shadow-lg shadow-black/5 ring-1 ring-white/10 dark:bg-background/60",
                  "backdrop-blur-xl",
                  "supports-[backdrop-filter]:bg-background/80 dark:supports-[backdrop-filter]:bg-background/55"
                )}
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask something…"
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    isComposingRef.current = false;
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (e.shiftKey) return;
                    if (isComposingRef.current) return;
                    if (isLoading) return;
                    e.preventDefault();
                    submitText(input);
                  }}
                  className={cn(
                    "min-h-11 max-h-56 resize-none overflow-y-auto",
                    "border-0 bg-transparent px-4 py-3",
                    "focus-visible:ring-0 focus-visible:border-transparent"
                  )}
                />
              </div>
            </form>
          </div>
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

