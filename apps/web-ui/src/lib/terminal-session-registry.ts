import { TerminalSessionClient } from "./terminal-session-client.js";

type Entry = {
  client: TerminalSessionClient;
  refs: number;
};

const clients = new Map<string, Entry>();

/** Shared session WS client — retain while workbench / job trackers need it. */
export function retainTerminalSessionClient(
  sessionId: string
): TerminalSessionClient {
  const id = sessionId.trim();
  let entry = clients.get(id);
  if (!entry) {
    const client = new TerminalSessionClient(id);
    client.connect();
    entry = { client, refs: 0 };
    clients.set(id, entry);
  }
  entry.refs += 1;
  return entry.client;
}

export function releaseTerminalSessionClient(sessionId: string): void {
  const id = sessionId.trim();
  const entry = clients.get(id);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.client.disconnect();
  clients.delete(id);
}

export function getTerminalSessionClient(
  sessionId: string
): TerminalSessionClient | null {
  return clients.get(sessionId.trim())?.client ?? null;
}

/** Test helper — drop all clients without waiting for refs. */
export function resetTerminalSessionRegistryForTests(): void {
  for (const entry of clients.values()) {
    entry.client.disconnect();
  }
  clients.clear();
}
