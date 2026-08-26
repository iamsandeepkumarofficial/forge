import {
  connectLocalProject,
  connectProject,
  createChat,
  ConnectProjectError
} from "../lib/projects-api.js";

export function errorMessage(err: unknown): string {
  if (err instanceof ConnectProjectError) {
    return err.help ? `${err.message}. ${err.help}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function connectLocalAndFinish(options: {
  localPath: string;
  finishConnect: (projectId: string) => Promise<void>;
}) {
  const result = await connectLocalProject(options.localPath);
  await options.finishConnect(result.projectId);
}

export async function connectGithubAndFinish(options: {
  fullName: string;
  finishConnect: (projectId: string) => Promise<void>;
}) {
  const result = await connectProject(options.fullName);
  await options.finishConnect(result.projectId);
}

export async function maybeCreateChat(options: {
  projectId: string;
  title: string;
}) {
  if (!options.title) return;
  try {
    await createChat(options.projectId, { title: options.title });
  } catch (err) {
    console.warn("[dashboard] createChat after connect failed", err);
  }
}
