"use client";

import { useChat } from "@ai-sdk/react";

export type RagChatConfig = {
  conversationId: string;
  kbIds: string[];
  initialMessages?: { id: string; role: "system" | "user" | "assistant"; content: string }[];
};

export function useRagChat(config: RagChatConfig) {
  const chat = useChat({
    messages: (config.initialMessages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })) as unknown,
  });

  async function sendText(text: string) {
    // Attach conversation_id and kb_ids on every request body.
    const sender = chat as unknown as {
      sendMessage: (
        msg: { text: string },
        opts: { body: { conversation_id: string; kb_ids: string[] } }
      ) => Promise<unknown>
    }
    return sender.sendMessage(
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

