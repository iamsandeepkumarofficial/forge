import { useParameterStore } from "./use-parameter-store.js";
import { useState } from "react";
import type { WorkspaceParameter } from "../lib/workspaces-api.js";

function ParameterRow(options: {
  row: WorkspaceParameter;
  busy: boolean;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const { row, busy, onSave, onDelete } = options;
  const [value, setValue] = useState(row.secret ? "" : row.value);
  const rowSync = `${row.key}:${row.secret ? "1" : "0"}:${row.value}`;
  const [syncKey, setSyncKey] = useState(rowSync);
  if (syncKey !== rowSync) {
    setSyncKey(rowSync);
    setValue(row.secret ? "" : row.value);
  }
  return (
    <li className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/40 px-3 py-2">
      <div className="min-w-[8rem] flex-1">
        <div className="font-mono text-sm">{row.key}</div>
        <div className="text-xs text-muted-foreground">
          {row.secret ? "secret" : "plain"}
          {row.hasValue === false || (!row.secret && !row.value)
            ? " · empty"
            : ""}
        </div>
      </div>
      <input
        className="min-w-[10rem] flex-1 rounded-md bg-background px-2 py-1.5 font-mono text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
        value={value}
        placeholder={row.secret ? "••••••••" : ""}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || (row.secret && !value)}
        onClick={() => onSave(value)}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        Delete
      </button>
    </li>
  );
}

export function ParameterStorePanel(options: { workspaceId: string }) {
  const store = useParameterStore(options.workspaceId);
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Parameter store</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Workspace env injected into every chat. Analyze lists param candidates
          as shadows; set or upsert values here (or via the setup agent).
          Workspace values override project parameters.
        </p>
      </div>
      {store.error ? (
        <p className="text-sm text-destructive">{store.error}</p>
      ) : null}
      {store.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          No parameters yet. Run Analyze for candidates, use Fix / setup agent,
          or add a key below.
        </p>
      ) : (
        <ul className="space-y-2">
          {store.rows.map((row) => (
            <ParameterRow
              key={row.key}
              row={row}
              busy={store.busy}
              onSave={(value) => void store.onSaveExisting(row, value)}
              onDelete={() => void store.onDelete(row.key)}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/40 px-3 py-3">
        <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
          Key
          <input
            className="rounded-md bg-background px-2 py-1.5 font-mono text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
            value={store.draftKey}
            onChange={(e) => store.setDraftKey(e.target.value)}
            placeholder="JWT_SECRET"
          />
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
          Value
          <input
            className="rounded-md bg-background px-2 py-1.5 font-mono text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
            value={store.draftValue}
            onChange={(e) => store.setDraftValue(e.target.value)}
            placeholder="value"
          />
        </label>
        <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={store.draftSecret}
            onChange={(e) => store.setDraftSecret(e.target.checked)}
          />
          Secret
        </label>
        <button
          type="button"
          disabled={store.busy || !store.draftKey.trim()}
          onClick={() => void store.onAdd()}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </section>
  );
}
