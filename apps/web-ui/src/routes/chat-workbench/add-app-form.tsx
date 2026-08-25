import { useState } from "react";
import {
  saveAppsConfig,
  type AppStatus,
  type ForgeApp,
  type AppType
} from "../../lib/tool-runner.js";

const DEFAULT_COMMAND = "pnpm run dev";
const DEFAULT_PORT = "3000";
const FIELD = "w-full rounded border px-2 py-1 text-xs";

type FieldHandlers = {
  name: string;
  cwd: string;
  command: string;
  port: string;
  type: AppType;
  saving: boolean;
  onNameChange: (v: string) => void;
  onCwdChange: (v: string) => void;
  onCommandChange: (v: string) => void;
  onPortChange: (v: string) => void;
  onTypeChange: (v: AppType) => void;
  onSave: () => void;
};

export function AddAppForm(options: {
  sessionId: string;
  apps: AppStatus[];
  onDone: () => void;
}) {
  const { sessionId, apps, onDone } = options;
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("");
  const [command, setCommand] = useState(DEFAULT_COMMAND);
  const [port, setPort] = useState(DEFAULT_PORT);
  const [type, setType] = useState<AppType>("web");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !cwd.trim()) {
      alert("name and cwd are required");
      return;
    }
    setSaving(true);
    try {
      const app: ForgeApp = {
        name: name.trim(),
        cwd: cwd.trim(),
        command: command.trim(),
        type
      };
      if (type !== "worker" && port.trim()) app.port = Number(port);
      const existing: ForgeApp[] = apps.map(
        ({ name: n, cwd: c, command: cmd, port: p, type: t }) => ({
          name: n,
          cwd: c,
          command: cmd,
          port: p,
          type: t
        })
      );
      await saveAppsConfig(sessionId, {
        apps: [...existing.filter((e) => e.name !== app.name), app]
      });
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AddAppFormFields
      name={name}
      cwd={cwd}
      command={command}
      port={port}
      type={type}
      saving={saving}
      onNameChange={setName}
      onCwdChange={setCwd}
      onCommandChange={setCommand}
      onPortChange={setPort}
      onTypeChange={setType}
      onSave={save}
    />
  );
}

function TypePortRow(options: FieldHandlers) {
  const { type, port, saving, onTypeChange, onPortChange, onSave } = options;
  return (
    <div className="flex gap-1.5">
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value as AppType)}
        className="rounded border bg-background px-1.5 py-1 text-xs"
      >
        <option value="web">web</option>
        <option value="api">api</option>
        <option value="worker">worker</option>
      </select>
      {type !== "worker" && (
        <input
          className="w-20 rounded border px-2 py-1 text-xs"
          placeholder="port"
          value={port}
          onChange={(e) => onPortChange(e.target.value)}
        />
      )}
      <div className="flex-1" />
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function AddAppFormFields(options: FieldHandlers) {
  const { name, cwd, command, onNameChange, onCwdChange, onCommandChange } =
    options;
  return (
    <div className="mx-2 mb-2 space-y-1.5 rounded border bg-muted p-2">
      <input
        className={FIELD}
        placeholder="name (e.g. web)"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
      />
      <input
        className={FIELD}
        placeholder="cwd (e.g. apps/web)"
        value={cwd}
        onChange={(e) => onCwdChange(e.target.value)}
      />
      <input
        className={FIELD}
        placeholder="command (e.g. pnpm run dev)"
        value={command}
        onChange={(e) => onCommandChange(e.target.value)}
      />
      <TypePortRow
        name={options.name}
        cwd={options.cwd}
        command={options.command}
        port={options.port}
        type={options.type}
        saving={options.saving}
        onNameChange={options.onNameChange}
        onCwdChange={options.onCwdChange}
        onCommandChange={options.onCommandChange}
        onPortChange={options.onPortChange}
        onTypeChange={options.onTypeChange}
        onSave={options.onSave}
      />
      <p className="text-[0.6rem] text-muted-foreground">
        Port must be 3000–3009 to be reachable (reserved block).
      </p>
    </div>
  );
}
