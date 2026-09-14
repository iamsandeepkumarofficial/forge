const MAX_DIR_NAME_LENGTH = 64;

export function sanitizeRepoDirectoryName(raw: string): string | null {
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    return null;
  }
  const base = trimmed
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, MAX_DIR_NAME_LENGTH);
  if (!base || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(base)) {
    return null;
  }
  return base;
}

export function deriveRepoDirectoryName(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  const m = trimmed.match(/[/:]([^/]+?)(?:\.git)?$/i);
  return sanitizeRepoDirectoryName(m?.[1] || "repo") || "repo";
}
export function assertSafeRepoDirectoryName(name: string): void {
  if (
    !name ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error(
      "Invalid directory name (use a single folder name, no path separators)"
    );
  }
}
