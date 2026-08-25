import { resolveSandbox } from "../projects/sandboxExec.js";
import type { ToolResult } from "./types.js";
import {
  ensurePackagedSkillsInSession,
  readSkillBodyFromHost
} from "./skillIndex.js";

export async function executeInvokeSkill(options: {
  sessionId: string;
  skillId: string;
}): Promise<ToolResult> {
  const skillId = options.skillId.trim();
  if (!skillId) {
    return { success: false, output: "skillId is required" };
  }
  const { workingDir } = await resolveSandbox(options.sessionId);
  ensurePackagedSkillsInSession(workingDir);
  const body = readSkillBodyFromHost({ workingDir, skillId });
  if (!body) {
    return {
      success: false,
      output: `Unknown skill: ${skillId}. Call list_skills to refresh the index.`
    };
  }
  return {
    success: true,
    output: body,
    metadata: { skillId }
  };
}
