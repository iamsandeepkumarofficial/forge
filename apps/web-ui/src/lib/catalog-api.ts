export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
};
function catalogBaseUrl(): string {
  return (
    import.meta.env.VITE_TOOL_RUNNER_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:4000"
  );
}
function catalogHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json"
  };
}
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string;
    };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    void 0;
  }
  return `${res.status} ${res.statusText}`;
}
export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${catalogBaseUrl()}/api/conversations`, {
    headers: catalogHeaders()
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const body = (await res.json()) as {
    data?: Conversation[];
  };
  return Array.isArray(body.data) ? body.data : [];
}
export async function upsertConversation(
  input: Conversation
): Promise<Conversation> {
  const res = await fetch(
    `${catalogBaseUrl()}/api/conversations/${encodeURIComponent(input.id)}`,
    {
      method: "PUT",
      headers: catalogHeaders(),
      body: JSON.stringify({
        title: input.title,
        updatedAt: input.updatedAt
      })
    }
  );
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as Conversation;
}
export async function fetchActiveSessionId(): Promise<string | null> {
  const res = await fetch(`${catalogBaseUrl()}/api/ui-state`, {
    headers: catalogHeaders()
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const body = (await res.json()) as {
    activeSessionId?: string | null;
  };
  return typeof body.activeSessionId === "string" &&
    body.activeSessionId.length > 0
    ? body.activeSessionId
    : null;
}
export async function persistActiveSessionId(sessionId: string): Promise<void> {
  const res = await fetch(`${catalogBaseUrl()}/api/ui-state`, {
    method: "PUT",
    headers: catalogHeaders(),
    body: JSON.stringify({ activeSessionId: sessionId })
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
}
