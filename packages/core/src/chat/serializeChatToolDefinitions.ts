import {
  MODE_TOOL_ALLOWLIST,
  effectiveToolMode,
  type AgentMode
} from "./agentMode.js";
import { formatToolDescription } from "./chatToolCatalog.js";

const WEB_TOOL_IDS = new Set(["web_search", "web_fetch"]);

export function serializeChatToolDefinitions(options: {
  agentMode: AgentMode;
  includeWebTools?: boolean;
}): string {
  const mode = effectiveToolMode(options.agentMode);
  const includeWeb = options.includeWebTools !== false;
  const ids = [...MODE_TOOL_ALLOWLIST[mode]]
    .filter((id) => includeWeb || !WEB_TOOL_IDS.has(id))
    .sort();
  return ids.map((id) => formatToolDescription(id)).join("\n\n");
}
