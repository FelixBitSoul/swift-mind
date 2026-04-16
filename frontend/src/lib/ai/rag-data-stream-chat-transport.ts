import type { UIMessage, UIMessageChunk } from "ai";
import { HttpChatTransport } from "ai";

type RagCitations = { citations?: unknown };

function parseDataStreamLine(line: string): { type: "text"; token: string } | { type: "finish"; data: RagCitations } | null {
  if (line.startsWith("0:")) {
    try {
      const token = JSON.parse(line.slice(2));
      if (typeof token === "string") return { type: "text", token };
    } catch {
      return null;
    }
  }
  if (line.startsWith("d:")) {
    try {
      const data = JSON.parse(line.slice(2));
      if (typeof data === "object" && data !== null) return { type: "finish", data: data as RagCitations };
    } catch {
      return null;
    }
  }
  return null;
}

function dataStreamToUiMessageChunks(stream: ReadableStream<string>): ReadableStream<UIMessageChunk> {
  let buffer = "";
  let finishData: RagCitations | null = null;

  return stream.pipeThrough(
    new TransformStream<string, UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "start" });
        controller.enqueue({ type: "start-step" });
        controller.enqueue({ type: "text-start", id: "text-1" });
      },
      transform(chunk, controller) {
        buffer += chunk;
        while (true) {
          const nl = buffer.indexOf("\n");
          if (nl === -1) break;
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          const parsed = parseDataStreamLine(line);
          if (!parsed) continue;
          if (parsed.type === "text") {
            controller.enqueue({ type: "text-delta", id: "text-1", delta: parsed.token });
          } else if (parsed.type === "finish") {
            finishData = parsed.data;
          }
        }
      },
      flush(controller) {
        // If last line had no trailing newline, try parse it too.
        const tail = buffer.trim();
        if (tail) {
          const parsed = parseDataStreamLine(tail);
          if (parsed?.type === "finish") finishData = parsed.data;
          if (parsed?.type === "text") controller.enqueue({ type: "text-delta", id: "text-1", delta: parsed.token });
        }

        controller.enqueue({ type: "text-end", id: "text-1" });
        controller.enqueue({ type: "finish-step" });
        if (finishData?.citations) {
          controller.enqueue({ type: "message-metadata", messageMetadata: { citations: finishData.citations } });
        }
        controller.enqueue({ type: "finish" });
      },
    })
  );
}

export class RagDataStreamChatTransport<UI_MESSAGE extends UIMessage>
  extends HttpChatTransport<UI_MESSAGE>
{
  processResponseStream(
    stream: ReadableStream<Uint8Array<ArrayBufferLike>>
  ): ReadableStream<UIMessageChunk> {
    const decoder = new TextDecoder();
    const decoded = stream.pipeThrough(
      new TransformStream<Uint8Array<ArrayBufferLike>, string>({
        transform(chunk, controller) {
          controller.enqueue(decoder.decode(chunk, { stream: true }));
        },
        flush(controller) {
          const tail = decoder.decode();
          if (tail) controller.enqueue(tail);
        },
      })
    );

    return dataStreamToUiMessageChunks(decoded);
  }
}

