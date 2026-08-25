import {
  connectProject,
  createChat,
  uploadProject,
  ConnectProjectError
} from "../lib/projects-api.js";
import {
  archiveNameForFolder,
  entriesFromDataTransfer,
  entriesFromFileList,
  zipProjectEntries
} from "../lib/zip-project-files.js";

export function errorMessage(err: unknown): string {
  if (err instanceof ConnectProjectError) {
    return err.help ? `${err.message}. ${err.help}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function uploadFolderList(options: {
  fileList: FileList;
  finishConnect: (projectId: string) => Promise<void>;
}) {
  const entries = entriesFromFileList(options.fileList);
  const root =
    entries[0]?.relativePath.split("/")[0] ||
    options.fileList[0]?.name ||
    "project";
  const zip = await zipProjectEntries(entries, archiveNameForFolder(root));
  const result = await uploadProject(zip);
  await options.finishConnect(result.projectId);
}

export async function uploadDroppedTransfer(options: {
  dataTransfer: DataTransfer;
  finishConnect: (projectId: string) => Promise<void>;
  onEmpty: () => void;
}) {
  const dropped = await entriesFromDataTransfer(options.dataTransfer);
  if (dropped.kind === "zip") {
    const result = await uploadProject(dropped.file);
    await options.finishConnect(result.projectId);
    return;
  }
  if (dropped.entries.length === 0) {
    options.onEmpty();
    return;
  }
  const zip = await zipProjectEntries(
    dropped.entries,
    archiveNameForFolder(dropped.name)
  );
  const result = await uploadProject(zip);
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

export { uploadProject };
