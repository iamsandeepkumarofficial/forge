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
export type WorkflowCatalogEntry = {
  id: string;
  name: string;
  version: number;
  stageCount: number;
  source: "user" | "system";
  finalColumn: string;
};
export type PipelineStage = {
  id: string;
  agent: string;
  column: string;
  action: "generate" | "implement";
  commentTitle: string;
  gate: "human" | "auto";
};
export type PipelineDefinition = {
  name: string;
  version: number;
  stages: PipelineStage[];
  finalColumn: string;
};
export type WorkflowDetail = {
  id: string;
  source: "user" | "system";
  definition: PipelineDefinition;
  yaml: string;
};
export type AgentCatalogEntry = {
  id: string;
  name: string;
  description: string;
  category?: string;
  source: "user" | "system";
  tools: string[];
};
export type AgentDefinition = {
  id: string;
  name: string;
  category?: string;
  description: string;
  model?: {
    provider?: string;
    name?: string;
    baseUrl?: string;
  };
  tools: string[];
  skills: string[];
  systemPrompt: string;
};
export type AgentDetail = {
  id: string;
  source: "user" | "system";
  definition: AgentDefinition;
  yaml: string;
};
export async function listWorkflows(): Promise<WorkflowCatalogEntry[]> {
  const res = await fetch(`${BASE_URL}/api/workflows`, { headers: headers() });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkflowCatalogEntry[];
}
export async function getWorkflowDefinition(
  id: string
): Promise<WorkflowDetail> {
  const res = await fetch(
    `${BASE_URL}/api/workflows/${encodeURIComponent(id)}`,
    {
      headers: headers()
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkflowDetail;
}
export async function saveWorkflow(
  id: string,
  body: {
    yaml?: string;
    definition?: PipelineDefinition;
  }
): Promise<WorkflowDetail> {
  const res = await fetch(
    `${BASE_URL}/api/workflows/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkflowDetail;
}
export async function deleteWorkflow(id: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/workflows/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: headers()
    }
  );
  if (!res.ok && res.status !== N_204) throw new Error(await readError(res));
}
export async function listAgents(): Promise<AgentCatalogEntry[]> {
  const res = await fetch(`${BASE_URL}/api/agents`, { headers: headers() });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as AgentCatalogEntry[];
}
export async function getAgentDefinition(id: string): Promise<AgentDetail> {
  const res = await fetch(`${BASE_URL}/api/agents/${encodeURIComponent(id)}`, {
    headers: headers()
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as AgentDetail;
}
export async function saveAgent(
  id: string,
  body: {
    yaml?: string;
    definition?: AgentDefinition;
  }
): Promise<AgentDetail> {
  const res = await fetch(`${BASE_URL}/api/agents/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as AgentDetail;
}
export async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/agents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers()
  });
  if (!res.ok && res.status !== N_204) throw new Error(await readError(res));
}
