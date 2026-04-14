"use client";

import { useChat } from "@ai-sdk/react";

export type RagChatConfig = {
  conversationId: string;
  kbIds: string[];
  initialMessages?: { id: string; role: "system" | "user" | "assistant"; content: string }[];
};

export function useRagChat(config: RagChatConfig) {
  const chat = useChat({
    messages: config.initialMessages as any,
  });

  async function sendText(text: string) {
    // Attach conversation_id and kb_ids on every request body.
    return (chat as any).sendMessage(
      { text },
      {
        body: {
          conversation_id: config.conversationId,
          kb_ids: config.kbIds,
        },
      }
    );
  }

  return { ...chat, sendText };
}

