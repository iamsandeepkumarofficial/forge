import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
const assistantMarkdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn("mt-4 mb-2 text-xl font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mt-3 mb-1.5 text-lg font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("mt-3 mb-1 text-base font-semibold first:mt-0", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn("my-2 leading-relaxed first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn("my-2 list-disc space-y-1 pl-5 first:mt-0", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("my-2 list-decimal space-y-1 pl-5 first:mt-0", className)}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("leading-relaxed", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "border-muted-foreground/30 text-muted-foreground my-2 border-l-2 pl-3 italic",
        className
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "text-primary underline-offset-2 hover:underline",
        className
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("border-border my-4", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "border-border bg-muted/50 my-2 max-h-72 overflow-x-auto rounded-lg border p-3 text-xs",
        className
      )}
      {...props}
    />
  ),
  code: ({ className: codeClassName, ...props }) => {
    const isBlock = Boolean(
      codeClassName?.split(/\s+/).some((c) => c.startsWith("language-"))
    );
    if (isBlock) {
      return (
        <code
          className={cn(
            "text-foreground block font-mono text-[0.8125rem] leading-relaxed",
            codeClassName
          )}
          {...props}
        />
      );
    }
    return (
      <code
        className={cn(
          "bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.8125rem]",
          codeClassName
        )}
        {...props}
      />
    );
  },
  table: ({ className, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={cn("border-border border-b", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border-border bg-muted/40 px-2 py-1.5 text-left font-semibold",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn("border-border border-t px-2 py-1.5", className)}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => <tr className={className} {...props} />
};
export function AssistantMarkdown({
  text,
  className,
  streamingIndicator
}: {
  text: string;
  className?: string;
  streamingIndicator?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed [&_pre_code]:bg-transparent",
        streamingIndicator &&
          "after:ml-0.5 after:inline-block after:h-[1.1em] after:w-1.5 after:animate-pulse after:rounded-sm after:bg-teal-500 after:align-text-bottom",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={assistantMarkdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
