import { ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  stringifyToolValue,
  synthesizeToolDiff,
  toolActivityBasename,
  toolActivityDetail,
  toolActivityLabel,
  toolPartName,
  truncateDiffText,
  type ToolPart
} from "@/lib/tool-display";
import { cn } from "@/lib/utils";

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
        <div className="text-[0.65rem] text-muted-foreground">
          {kind === "write" ? "Write" : "Edit"} · {path}
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
      <pre className="max-h-72 overflow-auto py-0.5 font-mono text-[0.7rem] whitespace-pre-wrap">
        <DiffText text={display} />
      </pre>
    </div>
  );
}
function toolFilePath(part: ToolPart): string | null {
  const input = part.input ?? part.args;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const path = (input as { path?: unknown }).path;
    if (typeof path === "string" && path.trim()) return path;
  }
  return null;
}

function ToolCallSummary(options: {
  label: string;
  path: string | null;
  command: string | null;
  added?: number;
  deleted?: number;
  pending: boolean;
  errorText?: string;
  hasDiff: boolean;
  outputUndefined: boolean;
  onOpenPath?: (path: string) => void;
}) {
  const {
    label,
    path,
    command,
    added,
    deleted,
    pending,
    errorText,
    hasDiff,
    outputUndefined,
    onOpenPath
  } = options;
  const fileName = path ? toolActivityBasename(path) : null;
  return (
    <summary className="group/summary flex cursor-pointer list-none items-center gap-1 py-0.5 text-xs text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
      <span className={cn("shrink-0 font-medium", pending && "italic")}>
        {label}
      </span>
      <span className="min-w-0 truncate">
        {fileName ? (
          onOpenPath && path ? (
            <button
              type="button"
              className="text-foreground/80 underline-offset-2 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenPath(path);
              }}
            >
              {fileName}
            </button>
          ) : (
            <span className="text-foreground/80">{fileName}</span>
          )
        ) : null}
        {command ? (
          <span className="text-muted-foreground">{`· ${command}`}</span>
        ) : null}
      </span>
      <ChevronRight className="size-3 shrink-0 opacity-0 transition-transform group-hover/summary:opacity-100 group-open/item:rotate-90 group-open/item:opacity-100" />
      {typeof added === "number" && added > 0 ? (
        <span className="shrink-0 text-[0.65rem] text-green-600 dark:text-green-400">
          +{added}
        </span>
      ) : null}
      {typeof deleted === "number" && deleted > 0 ? (
        <span className="shrink-0 text-[0.65rem] text-red-600 dark:text-red-400">
          -{deleted}
        </span>
      ) : null}
      {errorText ? (
        <span className="text-destructive italic">error</span>
      ) : null}
      {!pending && outputUndefined && !errorText && !hasDiff && (
        <span className="italic">no result</span>
      )}
    </summary>
  );
}

function ToolCallBody(options: {
  diff: ReturnType<typeof synthesizeToolDiff>;
  inputText: string;
  outputText: string;
  errorText?: string;
}) {
  const { diff, inputText, outputText, errorText } = options;
  return (
    <div className="mt-0.5 mb-1 space-y-1 pl-3 text-xs">
      {diff ? (
        <FileDiffPreview
          path={diff.path}
          kind={diff.kind}
          diffText={diff.diffText}
          totalLines={diff.totalLines}
        />
      ) : inputText ? (
        <pre className="max-h-52 overflow-auto font-mono whitespace-pre-wrap text-muted-foreground">
          {inputText}
        </pre>
      ) : null}
      {errorText ? (
        <pre className="max-h-52 overflow-auto font-mono whitespace-pre-wrap text-destructive">
          {errorText}
        </pre>
      ) : outputText && !diff ? (
        <pre className="max-h-72 overflow-auto font-mono whitespace-pre-wrap text-muted-foreground">
          {outputText}
        </pre>
      ) : outputText && diff ? (
        <p className="text-[0.65rem] text-muted-foreground">{outputText}</p>
      ) : null}
    </div>
  );
}

function ToolCallItem(options: {
  part: ToolPart;
  index: number;
  onOpenPath?: (path: string) => void;
  defaultOpen?: boolean;
}) {
  const { part: p, index: i, onOpenPath, defaultOpen } = options;
  const name = toolPartName(p);
  const input = p.input ?? p.args;
  const output = p.output ?? p.result;
  const diff = synthesizeToolDiff(name, input);
  const path = diff?.path ?? toolFilePath(p);
  const command = toolActivityDetail(name, {
    args: input,
    metadata: p.metadata
  });
  const inputText = diff ? "" : stringifyToolValue(input);
  const outputText = stringifyToolValue(output);
  const pending = output === undefined && !p.errorText;
  const key = p.toolCallId ?? `${name}-${i}`;
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <details
      key={key}
      className="group/item text-xs"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <ToolCallSummary
        label={toolActivityLabel(name, { pending })}
        path={path}
        command={command}
        added={diff?.added}
        deleted={diff?.deleted}
        pending={pending}
        errorText={p.errorText}
        hasDiff={Boolean(diff)}
        outputUndefined={output === undefined}
        onOpenPath={onOpenPath}
      />
      <ToolCallBody
        diff={diff}
        inputText={inputText}
        outputText={outputText}
        errorText={p.errorText}
      />
    </details>
  );
}
export function ToolCalls({
  parts,
  onOpenPath,
  defaultOpen
}: {
  parts: ToolPart[];
  onOpenPath?: (path: string) => void;
  defaultOpen?: boolean;
}) {
  if (parts.length === 0) return null;
  return (
    <div className="mt-1 space-y-0">
      {parts.map((p, i) => (
        <ToolCallItem
          key={p.toolCallId ?? i}
          part={p}
          index={i}
          onOpenPath={onOpenPath}
          defaultOpen={defaultOpen}
        />
      ))}
    </div>
  );
}
export { DiffText };
