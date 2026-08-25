import { pocToken, runnerUrl, userEmailHeader } from "./tool-runner.js";

const N_204 = 204;

const BASE_URL = runnerUrl();
function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${pocToken()}`,
    ...userEmailHeader()
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
export type DocumentRecord = {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  body: string;
  source: "user" | "agent";
  agentId: string | null;
  chatFeatureId: string | null;
  stageId: string | null;
  createdAt: string;
  updatedAt: string;
};
export async function listDocuments(
  projectId?: string
): Promise<DocumentRecord[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`${BASE_URL}/api/documents${qs}`, {
    headers: headers()
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as DocumentRecord[];
}
export async function getDocument(id: string): Promise<DocumentRecord> {
  const res = await fetch(
    `${BASE_URL}/api/documents/${encodeURIComponent(id)}`,
    {
      headers: headers()
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as DocumentRecord;
}
export async function createDocument(input: {
  title: string;
  body?: string;
  projectId?: string;
}): Promise<DocumentRecord> {
  const res = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as DocumentRecord;
}
export async function updateDocument(
  id: string,
  patch: {
    title?: string;
    body?: string;
    projectId?: string | null;
  }
): Promise<DocumentRecord> {
  const res = await fetch(
    `${BASE_URL}/api/documents/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(patch)
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as DocumentRecord;
}
export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/documents/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: headers()
    }
  );
  if (!res.ok && res.status !== N_204) throw new Error(await readError(res));
}
