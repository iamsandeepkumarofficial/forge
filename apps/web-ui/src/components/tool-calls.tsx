import { useState } from "react";
import {
  stringifyToolValue,
  synthesizeToolDiff,
  toolPartName,
  truncateDiffText,
  type ToolPart
} from "@/lib/tool-display";
function DiffText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        let cls = "";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          cls = "bg-green-500/10 text-green-700 dark:text-green-400";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          cls = "bg-destructive/10 text-destructive";
        } else if (line.startsWith("@@")) {
          cls = "text-primary";
        }
        return (
          <div key={i} className={cls}>
            {line || " "}
          </div>
        );
      })}
    </>
  );
}
function FileDiffPreview({
  path,
  kind,
  diffText,
  totalLines
}: {
  path: string;
  kind: "edit" | "write";
  diffText: string;
  totalLines: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const capped = truncateDiffText(diffText);
  const display = expanded ? diffText : capped.text;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <div className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
          {kind === "write" ? "Write preview" : "Edit preview"} · {path}
        </div>
        {capped.truncated && (
          <button
            type="button"
            className="text-[0.65rem] text-muted-foreground underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : `Expand (${totalLines} lines)`}
          </button>
        )}
      </div>
      <pre className="max-h-72 overflow-auto rounded bg-background/60 p-1.5 font-mono text-[0.7rem] whitespace-pre-wrap">
        <DiffText text={display} />
      </pre>
    </div>
  );
}
function ToolCallItem(options: {
  part: ToolPart;
  index: number;
  showEmoji: boolean;
}) {
  const { part: p, index: i, showEmoji } = options;
  const name = toolPartName(p);
  const input = p.input ?? p.args;
  const output = p.output ?? p.result;
  const diff = synthesizeToolDiff(name, input);
  const inputText = diff ? "" : stringifyToolValue(input);
  const outputText = stringifyToolValue(output);
  const pending = output === undefined && !p.errorText;
  const key = p.toolCallId ?? `${name}-${i}`;
  return (
    <details
      key={key}
      className="rounded border border-border bg-muted/40 text-xs"
      open={Boolean(diff)}
    >
      <summary className="flex cursor-pointer items-center gap-1.5 px-2 py-1 font-mono">
        {showEmoji && <span>🔧</span>}
        <span className="font-semibold">{name}</span>
        {diff && (
          <span className="truncate text-muted-foreground">{diff.path}</span>
        )}
        {pending && (
          <span className="text-muted-foreground italic">running…</span>
        )}
        {!pending && output === undefined && !p.errorText && !diff && (
          <span className="text-muted-foreground italic">no result</span>
        )}
      </summary>
      <div className="space-y-1 border-t border-border px-2 py-1.5">
        {diff ? (
          <FileDiffPreview
            path={diff.path}
            kind={diff.kind}
            diffText={diff.diffText}
            totalLines={diff.totalLines}
          />
        ) : inputText ? (
          <div>
            <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
              Input
            </div>
            <pre className="max-h-52 overflow-auto rounded bg-background/60 p-1.5 font-mono whitespace-pre-wrap">
              {inputText}
            </pre>
          </div>
        ) : null}
        {p.errorText ? (
          <div>
            <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-destructive">
              Error
            </div>
            <pre className="max-h-52 overflow-auto rounded bg-destructive/10 p-1.5 font-mono whitespace-pre-wrap text-destructive">
              {p.errorText}
            </pre>
          </div>
        ) : outputText && !diff ? (
          <div>
            <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
              Output
            </div>
            <pre className="max-h-72 overflow-auto rounded bg-background/60 p-1.5 font-mono whitespace-pre-wrap">
              {outputText}
            </pre>
          </div>
        ) : outputText && diff ? (
          <p className="text-[0.65rem] text-muted-foreground">{outputText}</p>
        ) : null}
      </div>
    </details>
  );
}
export function ToolCalls({
  parts,
  showEmoji = false
}: {
  parts: ToolPart[];
  showEmoji?: boolean;
}) {
  if (parts.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {parts.map((p, i) => (
        <ToolCallItem
          key={p.toolCallId ?? i}
          part={p}
          index={i}
          showEmoji={showEmoji}
        />
      ))}
    </div>
  );
}
export { DiffText };
