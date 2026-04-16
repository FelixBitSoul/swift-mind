"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { RagDataStreamChatTransport } from "@/lib/ai/rag-data-stream-chat-transport";

export type RagChatConfig = {
  conversationId: string;
  kbIds: string[];
  initialMessages?: { id: string; role: "system" | "user" | "assistant"; content: string; metadata?: unknown }[];
};

export function useRagChat(config: RagChatConfig) {
  const chat = useChat({
    transport: new RagDataStreamChatTransport({
      api: "/api/chat",
      body: {
        conversation_id: config.conversationId,
        kb_ids: config.kbIds,
      },
    }),
    messages: (config.initialMessages ?? []).map(
      (m): UIMessage => ({
        id: m.id,
        role: m.role,
        metadata: m.metadata,
        parts: [{ type: "text", text: m.content }],
      })
    ),
  });

  async function sendText(text: string) {
    const sender = chat as unknown as {
      sendMessage: (
        msg: { text: string },
        opts?: unknown
      ) => Promise<unknown>
    }
    return sender.sendMessage({ text }, undefined);
  }

  return { ...chat, sendText };
}

