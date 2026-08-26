import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_STORAGE_ROOT = path.join(os.homedir(), ".forge", "storage");

function expandHome(raw: string): string {
  if (raw.startsWith("~/")) {
    return path.resolve(os.homedir(), raw.slice(2));
  }
  return raw;
}

function storageRoot(): string {
  const raw = process.env.FORGE_STORAGE_ROOT?.trim();
  if (!raw) return DEFAULT_STORAGE_ROOT;
  const expanded = expandHome(raw);
  return path.isAbsolute(expanded)
    ? expanded
    : path.resolve(process.cwd(), expanded);
}

function resolveKeyPath(bucket: string, key: string): string {
  const normalized = key.replace(/^\/+/, "").replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.split("/").some((seg) => seg === ".." || seg === "")
  ) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return path.join(storageRoot(), bucket, ...normalized.split("/"));
}

export async function getObject(
  bucket: string,
  key: string
): Promise<Uint8Array | null> {
  try {
    const filePath = resolveKeyPath(bucket, key);
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export async function putObject(options: {
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType?: string;
}): Promise<void> {
  const filePath = resolveKeyPath(options.bucket, options.key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(options.body));
}

export function ticketAttachmentKey(
  chatFeatureId: string,
  attachmentId: string
): string {
  return `tickets/${chatFeatureId}/att/${attachmentId}`;
}

export async function objectExists(
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await fs.access(resolveKeyPath(bucket, key));
    return true;
  } catch {
    return false;
  }
}

export async function listObjectsWithPrefix(
  bucket: string,
  prefix: string
): Promise<string[]> {
  const root = path.join(storageRoot(), bucket);
  const prefixNorm = prefix.replace(/^\/+/, "").replace(/\\/g, "/");
  const keys: string[] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, nextRel);
      } else if (entry.isFile() && nextRel.startsWith(prefixNorm)) {
        keys.push(nextRel);
      }
    }
  }
  await walk(root, "");
  return keys;
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  try {
    await fs.unlink(resolveKeyPath(bucket, key));
  } catch {
    /* ignore missing */
  }
}

export async function deleteObjectsWithPrefix(
  bucket: string,
  prefix: string
): Promise<void> {
  const keys = await listObjectsWithPrefix(bucket, prefix);
  await Promise.all(keys.map((key) => deleteObject(bucket, key)));
}
