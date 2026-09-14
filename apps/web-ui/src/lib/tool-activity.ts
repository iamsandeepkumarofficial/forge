const ACTIVITY_LABELS: Record<string, { pending: string; done: string }> = {
  edit_file: { pending: "Editing", done: "Edited" },
  write_file: { pending: "Writing", done: "Wrote" },
  delete_files: { pending: "Deleting", done: "Deleted" },
  move_files: { pending: "Moving", done: "Moved" },
  read_file: { pending: "Reading", done: "Read" },
  list_files: { pending: "Searching", done: "Searched" },
  list_dir: { pending: "Searching", done: "Searched" },
  search_codebase: { pending: "Searching", done: "Searched" },
  run_terminal: { pending: "Running terminal", done: "Ran terminal" },
  preview_start: { pending: "Starting preview", done: "Started preview" },
  preview_stop: { pending: "Stopping preview", done: "Stopped preview" },
  web_search: { pending: "Searching", done: "Searched" },
  web_fetch: { pending: "Fetching", done: "Fetched" },
  ask_user: { pending: "Asking", done: "Asked" },
  upsert_workspace_parameter: {
    pending: "Upserting parameter",
    done: "Upserted parameter"
  },
  upsert_launch_app: {
    pending: "Upserting launch app",
    done: "Upserted launch app"
  }
};

const DETAIL_MAX = 48;

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(
  record: Record<string, unknown> | null,
  key: string
): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shortenActivityDetail(value: string): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  return oneLine.length > DETAIL_MAX
    ? `${oneLine.slice(0, DETAIL_MAX - 1)}…`
    : oneLine;
}

export function toolActivityLabel(
  toolName: string,
  options?: { pending?: boolean }
): string {
  const pending = options?.pending === true;
  const mapped = ACTIVITY_LABELS[toolName];
  if (mapped) return pending ? mapped.pending : mapped.done;
  const words = toolName.replace(/_/g, " ").trim();
  if (!words) return pending ? "Working" : "Done";
  if (!pending) return words.replace(/\b\w/g, (c) => c.toUpperCase());
  const [first, ...rest] = words.split(/\s+/);
  const stem = first.endsWith("e") ? first.slice(0, -1) : first;
  return [titleCaseWord(`${stem}ing`), ...rest].join(" ");
}

export function toolActivityBasename(path: string): string {
  const trimmed = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const i = trimmed.lastIndexOf("/");
  return i >= 0 ? trimmed.slice(i + 1) : trimmed;
}

export function toolActivityCommand(args: unknown): string | null {
  const record = asRecord(args);
  if (!record) return null;
  const command = record.command;
  if (typeof command === "string" && command.trim()) {
    return shortenActivityDetail(command);
  }
  return null;
}

function previewAppName(extras: {
  args: unknown;
  metadata?: Record<string, unknown>;
}): string | null {
  const fromArgs = stringField(asRecord(extras.args), "name");
  if (fromArgs) return fromArgs;
  const app = asRecord(extras.metadata?.app);
  return stringField(app, "name");
}

function parameterKeysGlimpse(args: unknown): string | null {
  const record = asRecord(args);
  if (!record) return null;
  const single = stringField(record, "key");
  if (single) return single;
  if (!Array.isArray(record.items) || record.items.length === 0) return null;
  const keys = record.items
    .map((item) => stringField(asRecord(item), "key"))
    .filter((key): key is string => Boolean(key));
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0]!;
  return `${keys[0]} +${keys.length - 1}`;
}

export function toolActivityGlimpse(
  toolName: string,
  extras?: { args?: unknown; metadata?: Record<string, unknown> }
): string | null {
  const args = extras?.args;
  const metadata = extras?.metadata;
  if (
    toolName === "preview_start" ||
    toolName === "preview_stop" ||
    toolName === "preview_logs" ||
    toolName === "preview_status"
  ) {
    const name = previewAppName({ args, metadata });
    return name ? shortenActivityDetail(name) : null;
  }
  if (toolName === "upsert_workspace_parameter") {
    const keys = parameterKeysGlimpse(args);
    return keys ? shortenActivityDetail(keys) : null;
  }
  if (toolName === "upsert_launch_app") {
    const name = stringField(asRecord(args), "name");
    return name ? shortenActivityDetail(name) : null;
  }
  return null;
}

export function toolActivityDetail(
  toolName: string,
  extras?: { args?: unknown; metadata?: Record<string, unknown> }
): string | null {
  if (toolName === "run_terminal") return toolActivityCommand(extras?.args);
  return toolActivityGlimpse(toolName, extras);
}
