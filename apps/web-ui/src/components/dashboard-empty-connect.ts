import {
  connectLocalProject,
  connectProject,
  ConnectProjectError
} from "../lib/projects-api.js";
import { createWorkspaceChat } from "../lib/workspaces-api.js";

export function errorMessage(err: unknown): string {
  if (err instanceof ConnectProjectError) {
    return err.help ? `${err.message}. ${err.help}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function connectLocalAndFinish(options: {
  localPath: string;
  finishConnect: (workspaceId: string) => Promise<void>;
}) {
  const result = await connectLocalProject(options.localPath);
  await options.finishConnect(result.workspaceId);
}

export async function connectGithubAndFinish(options: {
  fullName: string;
  finishConnect: (workspaceId: string) => Promise<void>;
}) {
  const result = await connectProject(options.fullName);
  await options.finishConnect(result.workspaceId);
}

export async function maybeCreateWorkspaceChat(options: {
  workspaceId: string;
  title: string;
}) {
  if (!options.title) return;
  try {
    await createWorkspaceChat({
      workspaceId: options.workspaceId,
      title: options.title
    });
  } catch (err) {
    console.warn("[dashboard] createWorkspaceChat after connect failed", err);
  }
}
