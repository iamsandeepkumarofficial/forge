import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AGENT_MODE_IDS } from "@forge/core";
import { buildModeAwareSystemPrompt, modeAddendum } from "./chatModePrompt.js";

describe("chatModePrompt", () => {
  it("appends each mode addendum", () => {
    const labels: Record<(typeof AGENT_MODE_IDS)[number], string> = {
      agent: "Agent",
      plan: "Plan",
      debug: "Debug",
      ask: "Ask",
      multitask: "Multitask",
      auto: "Auto"
    };
    for (const mode of AGENT_MODE_IDS) {
      const text = buildModeAwareSystemPrompt("BASE", mode);
      assert.match(text, /^BASE\n\n/);
      assert.match(text, new RegExp(`You are in ${labels[mode]} mode`));
    }
  });

  it("plan forbids source edits and allows launch.json preview", () => {
    const plan = modeAddendum("plan");
    assert.match(plan, /Plan mode/);
    assert.match(plan, /do not edit source/);
    assert.match(plan, /preview_\*/);
    assert.match(plan, /create_subtask/);
  });

  it("ask forbids mutations", () => {
    const ask = modeAddendum("ask");
    assert.match(ask, /Ask mode/);
    assert.match(ask, /Do not edit source/);
    assert.match(ask, /preview_status\/logs/);
  });

  it("agent and debug forbid starting apps via run_terminal", () => {
    assert.match(modeAddendum("agent"), /Never start apps with run_terminal/);
    assert.match(modeAddendum("debug"), /preview_start, not run_terminal/);
  });

  it("agent upserts launch.json without asking first", () => {
    assert.match(modeAddendum("agent"), /upsert_launch_app \(no need to ask\)/);
  });

  it("agent forbids switching to Ask for implement/run work", () => {
    const agent = modeAddendum("agent");
    assert.match(agent, /Do not call switch_mode to Ask/);
    assert.match(agent, /stop and wait for confirmation/);
  });
});
