"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

const schema: Schema = {
  ...defaultSchema,
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    a: [
      ...(((defaultSchema.attributes ?? {})["a"] as string[] | undefined) ?? []),
      "href",
      "title",
      "target",
      "rel",
    ],
    code: [
      ...(((defaultSchema.attributes ?? {})["code"] as string[] | undefined) ?? []),
      "className",
    ],
    span: [
      ...(((defaultSchema.attributes ?? {})["span"] as string[] | undefined) ?? []),
      "className",
    ],
  },
};

function emphasizeFootnoteMarkers(markdown: string): string {
  // Make markers like [1] more visible, without touching fenced code blocks.
  // We keep it simple and only protect triple-backtick fences.
  const parts = markdown.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith("```")) return part;
      // Replace [n] with bolded marker. This stays valid markdown and survives sanitization.
      return part.replace(/\[(\d{1,3})\]/g, "**[$1]**");
    })
    .join("");
}

export function MarkdownMessage(props: { content: string }) {
  const content = emphasizeFootnoteMarkers(props.content);
  return (
    <div className="text-sm leading-6 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ children, href, ...rest }) => (
            <a
              {...rest}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground"
            >
              {children}
            </a>
          ),
          p: ({ children }) => <p className="whitespace-pre-wrap break-words [&:not(:first-child)]:mt-2">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1 [&:not(:first-child)]:mt-2">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1 [&:not(:first-child)]:mt-2">{children}</ol>,
          li: ({ children }) => <li className="break-words">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mt-2 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-muted-foreground/20" />,
          table: ({ children }) => (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-muted-foreground/20 bg-muted/30 px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-muted-foreground/20 px-2 py-1 align-top">{children}</td>,
          code: ({ children, className }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-md bg-muted/30 px-3 py-2 text-xs leading-5 text-foreground">
                  {children}
                </code>
              );
            }
            return <code className="rounded bg-muted/40 px-1 py-0.5 text-[0.85em]">{children}</code>;
          },
          pre: ({ children }) => <pre className="mt-2 overflow-x-auto rounded-md">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

