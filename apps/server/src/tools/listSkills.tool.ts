import { resolveSandbox } from "../projects/sandboxExec.js";
import type { ToolResult } from "./types.js";
import { invalidateSkillIndex, loadSkillIndexForPrompt } from "./skillIndex.js";

export async function executeListSkills(
  sessionId: string
): Promise<ToolResult> {
  const { workingDir } = await resolveSandbox(sessionId);
  invalidateSkillIndex(sessionId);
  const entries = loadSkillIndexForPrompt({ sessionId, workingDir });
  return {
    success: true,
    output: JSON.stringify(entries, null, 2),
    metadata: { skills: entries }
  };
}
