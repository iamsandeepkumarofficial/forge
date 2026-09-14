export { INSPECT_HTML } from "./inspectPageHtml.js";
export { INSPECT_JS } from "./inspectPageJs.js";
export { CLEAR_HTML } from "./inspectPageClear.js";

export function inspectAsset(
  url: string | undefined
): "html" | "js" | "clear" | null {
  const path = (url ?? "/").split("?")[0];
  if (path === "/__forge/inspect" || path === "/__forge/inspect/") return "html";
  if (path === "/__forge/inspect.js") return "js";
  if (path === "/__forge/clear" || path === "/__forge/clear/") return "clear";
  return null;
}
