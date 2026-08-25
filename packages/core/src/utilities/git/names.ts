export function deriveRepoDirectoryName(url: string): string {
  const maxDirNameLength = 64;
  const trimmed = url.trim().replace(/\/$/, "");
  const m = trimmed.match(/[/:]([^/]+?)(?:\.git)?$/i);
  const base = (m?.[1] || "repo").replace(/[^a-zA-Z0-9._-]/g, "-");
  return base.slice(0, maxDirNameLength) || "repo";
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
