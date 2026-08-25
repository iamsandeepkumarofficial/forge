import { Zip, ZipDeflate } from "fflate";
const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  "__MACOSX",
  ".turbo",
  ".vercel",
  ".cache",
  ".output"
]);
const SKIP_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
export type ProjectFileEntry = {
  relativePath: string;
  file: File;
};
export function shouldIncludeProjectPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return false;
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((seg) => SKIP_DIR_SEGMENTS.has(seg))) return false;
  const base = segments[segments.length - 1]!;
  if (SKIP_FILE_NAMES.has(base)) return false;
  return true;
}
function sanitizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}
export function entriesFromFileList(
  fileList: FileList | File[]
): ProjectFileEntry[] {
  const files = Array.from(fileList);
  const entries: ProjectFileEntry[] = [];
  for (const file of files) {
    const relativePath = sanitizeRelativePath(
      (
        file as File & {
          webkitRelativePath?: string;
        }
      ).webkitRelativePath || file.name
    );
    if (!shouldIncludeProjectPath(relativePath)) continue;
    entries.push({ relativePath, file });
  }
  return entries;
}

async function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function pushFileEntry(options: {
  entry: FileSystemFileEntry;
  relativePath: string;
  out: ProjectFileEntry[];
}): Promise<void> {
  const { entry, relativePath, out } = options;
  if (!shouldIncludeProjectPath(relativePath)) return;
  const file = await readEntryAsFile(entry);
  out.push({ relativePath: sanitizeRelativePath(relativePath), file });
}

async function processDirectoryBatchEntry(options: {
  entry: FileSystemEntry;
  prefix: string;
  out: ProjectFileEntry[];
}): Promise<void> {
  const { entry, prefix, out } = options;
  const nextPath = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isDirectory) {
    if (SKIP_DIR_SEGMENTS.has(entry.name)) return;
    await readDirectoryEntry({
      dir: entry as FileSystemDirectoryEntry,
      prefix: nextPath,
      out
    });
    return;
  }
  if (entry.isFile) {
    await pushFileEntry({
      entry: entry as FileSystemFileEntry,
      relativePath: nextPath,
      out
    });
  }
}

async function readDirectoryEntry(options: {
  dir: FileSystemDirectoryEntry;
  prefix: string;
  out: ProjectFileEntry[];
}): Promise<void> {
  const { dir, prefix, out } = options;
  const reader = dir.createReader();
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  let batch = await readBatch();
  while (batch.length > 0) {
    for (const entry of batch) {
      await processDirectoryBatchEntry({ entry, prefix, out });
    }
    batch = await readBatch();
  }
}

async function collectFromRootEntries(
  rootEntries: FileSystemEntry[]
): Promise<{ entries: ProjectFileEntry[]; folderName: string }> {
  const collected: ProjectFileEntry[] = [];
  let folderName = "project";
  for (const entry of rootEntries) {
    if (entry.isDirectory) {
      folderName = entry.name || folderName;
      await readDirectoryEntry({
        dir: entry as FileSystemDirectoryEntry,
        prefix: entry.name,
        out: collected
      });
      continue;
    }
    if (entry.isFile) {
      await pushFileEntry({
        entry: entry as FileSystemFileEntry,
        relativePath: entry.name,
        out: collected
      });
    }
  }
  return { entries: collected, folderName };
}

export async function entriesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<
  | {
      kind: "zip";
      file: File;
    }
  | {
      kind: "folder";
      entries: ProjectFileEntry[];
      name: string;
    }
> {
  const items = dataTransfer.items;
  if (items && items.length > 0) {
    const rootEntries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i]?.webkitGetAsEntry?.();
      if (entry) rootEntries.push(entry);
    }
    if (rootEntries.length === 1 && rootEntries[0]!.isFile) {
      const file = dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith(".zip")) {
        return { kind: "zip", file };
      }
    }
    if (rootEntries.some((e) => e.isDirectory) || rootEntries.length > 1) {
      const { entries, folderName } = await collectFromRootEntries(rootEntries);
      return { kind: "folder", entries, name: folderName };
    }
  }
  const files = Array.from(dataTransfer.files ?? []);
  if (files.length === 1 && files[0]!.name.toLowerCase().endsWith(".zip")) {
    return { kind: "zip", file: files[0]! };
  }
  if (files.length === 0) {
    return { kind: "folder", entries: [], name: "project" };
  }
  const entries = entriesFromFileList(files);
  const firstRel = entries[0]?.relativePath ?? "project";
  const name = firstRel.includes("/") ? firstRel.split("/")[0]! : "project";
  return { kind: "folder", entries, name };
}
export function archiveNameForFolder(folderName: string): string {
  const safe =
    folderName.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
  return `${safe}.zip`;
}
async function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }
  return await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
export async function zipProjectEntries(
  entries: ProjectFileEntry[],
  archiveName: string
): Promise<File> {
  if (entries.length === 0) {
    throw new Error("No files found in the selected folder.");
  }
  const chunks: BlobPart[] = [];
  await new Promise<void>((resolve, reject) => {
    const zipper = new Zip((...args) => {
      const [err, data, final] = args as [Error | null, Uint8Array, boolean];
      if (err) {
        reject(err);
        return;
      }
      chunks.push(data as BlobPart);
      if (final) resolve();
    });
    void (async () => {
      try {
        for (const { relativePath, file } of entries) {
          const entry = new ZipDeflate(relativePath, { level: 1 });
          entry.mtime = file.lastModified;
          zipper.add(entry);
          const buf = await readFileBytes(file);
          entry.push(buf, true);
        }
        zipper.end();
      } catch (err) {
        reject(err);
      }
    })();
  });
  const name = archiveName.toLowerCase().endsWith(".zip")
    ? archiveName
    : `${archiveName}.zip`;
  return new File(chunks, name, { type: "application/zip" });
}
