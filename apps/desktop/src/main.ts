const statusEl = document.getElementById("status");

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke: (cmd: string, args?: unknown) => Promise<unknown>;
      };
    };
  }
}

async function refreshStatus(): Promise<void> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
    if (statusEl) {
      statusEl.textContent =
        "Open via `pnpm --filter @forge/desktop tauri dev` to talk to the supervisor.";
    }
    return;
  }
  try {
    const status = await invoke("get_status");
    if (statusEl) statusEl.textContent = String(status);
  } catch (err) {
    if (statusEl) statusEl.textContent = String(err);
  }
}

void refreshStatus();
