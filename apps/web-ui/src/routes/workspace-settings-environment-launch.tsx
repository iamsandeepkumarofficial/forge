type LaunchApp = Record<string, unknown>;

export function EnvironmentLaunchCard(options: {
  apps: LaunchApp[];
  updatedAt: string | null;
  busy: boolean;
  anyBusy: boolean;
  onClear: () => void;
}) {
  const { apps, updatedAt, busy, anyBusy, onClear } = options;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-medium">Saved launch</h4>
          <p className="text-sm text-muted-foreground">
            {updatedAt
              ? `Last saved ${new Date(updatedAt).toLocaleString()}`
              : "No saved launch yet — Fix a chat until apps start."}
          </p>
        </div>
        <button
          type="button"
          disabled={anyBusy || apps.length === 0}
          onClick={onClear}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          {busy ? "Clearing…" : "Clear saved launch"}
        </button>
      </div>
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Empty — new chats will detect apps or wait for Fix.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {apps.map((app, i) => (
            <li
              key={`${String(app.name ?? "app")}-${i}`}
              className="space-y-0.5 px-3 py-2 text-sm"
            >
              <div className="font-medium">
                {String(app.name ?? "unnamed")}
                {app.type ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {String(app.type)}
                  </span>
                ) : null}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {[
                  app.repo ? `repo ${app.repo}` : null,
                  app.cwd ? `cwd ${app.cwd}` : null,
                  app.port != null ? `port ${app.port}` : null
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {app.command ? (
                <div className="font-mono text-xs text-muted-foreground">
                  {String(app.command)}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
