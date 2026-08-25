import path from "node:path";
export interface WorkspacePathResult {
  absPath: string;
  displayPath: string;
}
export async function resolveSessionWorkspacePath(
  cwd: string,
  relativePath: string
): Promise<WorkspacePathResult> {
  const resolved = path.resolve(cwd, relativePath);
  return {
    absPath: resolved,
    displayPath: relativePath || resolved
  };
}
