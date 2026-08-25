const DEV_SERVER_RE =
  /\b(?:npm|pnpm|yarn|bun)(?:\s+exec)?\s+(?:run\s+)?(?:dev|start|serve)\b|\b(?:npx\s+)?(?:vite|next|nuxt)\s+dev\b|\b(?:npx\s+)?remix\s+(?:vite:)?dev\b|\bnodemon\b|\btsx\s+watch\b|\bts-node-dev\b|\bflask\s+run\b|\buvicorn\b|\bpython(?:3)?\s+-m\s+http\.server\b/i;

export function isLongRunningDevServerCommand(command: string): boolean {
  return DEV_SERVER_RE.test(command.trim());
}

export function longRunningDevServerDeniedMessage(): string {
  return [
    "Do not start long-running dev servers with run_terminal (it hangs until timeout).",
    "Use preview_start for apps listed in .forge/launch.json.",
    "If the app is missing, upsert_launch_app, then preview_start."
  ].join(" ");
}
