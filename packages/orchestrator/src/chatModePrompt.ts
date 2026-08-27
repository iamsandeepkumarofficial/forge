import type { AgentMode } from "@forge/core";

const MODE_ADDENDA: Record<AgentMode, string> = {
  agent: [
    "You are in Agent mode. Implement the user's request with file, shell, and",
    "preview tools.",
    "App startup rules (strict): Never start apps with run_terminal (including",
    "npm/yarn/pnpm run dev|start, vite, next). Use upsert_launch_app if launch.json",
    "is missing/incomplete (no need to ask), then preview_start. Do not apt-install",
    "databases or system services to boot the app — ask the user if an external",
    "dependency is required.",
    "To log a distinct follow-up card,",
    "ask to switch to Plan. Do not call switch_mode to Ask when the user wants",
    "implementation, edits, or running apps — stay in Agent and do the work.",
    "Only propose Ask for pure Q&A with no changes. Outside Auto, if you call",
    "switch_mode, stop and wait for confirmation — do not keep using tools."
  ].join("\n"),
  plan: [
    "You are in Plan mode. Propose an approach; do not edit source, run shell, or",
    "touch git. You may read the repo, inspect/start/stop launch.json apps with",
    "preview_* (listed names only), and upsert_launch_app when launch.json is missing",
    "or incomplete. Log out-of-scope follow-up with create_subtask. To implement code,",
    "ask to switch to Agent (or switch_mode and wait) unless Auto. Outside Auto, after",
    "switch_mode, stop and wait for confirmation."
  ].join("\n"),
  debug: [
    "You are in Debug mode. Find root cause: reproduce with preview_logs/status,",
    "search, and tests (run_terminal). Start apps with preview_start, not run_terminal.",
    "Prefer a minimal fix; do not expand scope.",
    "If launch.json is missing, upsert_launch_app then preview_start. Ask before switching modes unless Auto.",
    "Outside Auto, after switch_mode, stop and wait for confirmation."
  ].join("\n"),
  ask: [
    "You are in Ask mode. Answer questions only. Do not edit source, run shell, start",
    "or stop apps, edit launch.json, or create subtasks. You may read the repo,",
    "preview_status/logs, web tools, and skills. To change anything, ask to switch",
    "to Agent/Plan/Debug (or switch_mode and wait) unless Auto. Outside Auto, after",
    "switch_mode, stop and wait for confirmation."
  ].join("\n"),
  multitask: [
    "You are in Multitask mode. Implement the current thread, and split distinct",
    "parallel follow-ups with create_subtask instead of doing everything inline.",
    "If launch.json is missing, upsert_launch_app then preview_start. Ask before switching modes unless Auto.",
    "Outside Auto, after switch_mode, stop and wait for confirmation."
  ].join("\n"),
  auto: [
    "You are in Auto mode. Default behavior is Agent (implement). You may call",
    "switch_mode to Plan, Debug, Ask, Multitask, or Agent without asking the user.",
    "After a switch, follow that mode's rules and tools. App startup: upsert_launch_app",
    "then preview_start — never run_terminal for dev servers. Do not switch to Ask when",
    "the user wants implementation or to run apps."
  ].join("\n")
};

export function buildModeAwareSystemPrompt(
  baseSystem: string,
  mode: AgentMode
): string {
  return `${baseSystem}\n\n${MODE_ADDENDA[mode]}`;
}

export function modeAddendum(mode: AgentMode): string {
  return MODE_ADDENDA[mode];
}
