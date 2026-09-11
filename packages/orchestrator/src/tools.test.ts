import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  availableToolNames,
  buildChatTools,
  buildTools,
  executeNamedTool,
  executeAskUser,
  executeSwitchMode,
  webToolsEnabled,
  withWebToolsIfEnabled
} from "./tools.js";

const originalFetch = globalThis.fetch;
const originalWeb = process.env.WEB_TOOLS_ENABLED;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWeb === undefined) delete process.env.WEB_TOOLS_ENABLED;
  else process.env.WEB_TOOLS_ENABLED = originalWeb;
});

describe("tools", () => {
  it("webToolsEnabled parses truthy and falsy values", () => {
    delete process.env.WEB_TOOLS_ENABLED;
    assert.equal(webToolsEnabled(), false);
    process.env.WEB_TOOLS_ENABLED = "true";
    assert.equal(webToolsEnabled(), true);
    process.env.WEB_TOOLS_ENABLED = "1";
    assert.equal(webToolsEnabled(), true);
    process.env.WEB_TOOLS_ENABLED = "yes";
    assert.equal(webToolsEnabled(), true);
    process.env.WEB_TOOLS_ENABLED = "on";
    assert.equal(webToolsEnabled(), true);
    process.env.WEB_TOOLS_ENABLED = "false";
    assert.equal(webToolsEnabled(), false);
  });

  it("withWebToolsIfEnabled appends web tools when enabled", () => {
    delete process.env.WEB_TOOLS_ENABLED;
    assert.deepEqual(withWebToolsIfEnabled(["read_file"]), ["read_file"]);
    process.env.WEB_TOOLS_ENABLED = "true";
    assert.deepEqual(withWebToolsIfEnabled(["read_file"]), [
      "read_file",
      "web_search",
      "web_fetch"
    ]);
    assert.deepEqual(withWebToolsIfEnabled([]), []);
  });

  it("availableToolNames has chat tools and omits ghost tools", () => {
    process.env.WEB_TOOLS_ENABLED = "false";
    const names = availableToolNames();
    assert.ok(names.includes("read_file"));
    assert.ok(names.includes("write_file"));
    assert.ok(names.includes("preview_status"));
    assert.ok(names.includes("upsert_launch_app"));
    assert.ok(names.includes("list_skills"));
    assert.ok(names.includes("switch_mode"));
    assert.ok(names.includes("ask_user"));
    assert.ok(names.includes("docker_image_lookup"));
    assert.ok(names.includes("setup_project_infra"));
    assert.ok(names.includes("install_project_infra"));
    assert.equal(names.includes("provision_app_engine"), false);
    assert.equal(names.includes("git_clone"), false);
    assert.equal(names.includes("jira_get_ticket"), false);
    assert.equal(names.includes("github_create_pr"), false);
    process.env.WEB_TOOLS_ENABLED = "true";
    const withWeb = availableToolNames();
    assert.ok(withWeb.includes("web_search"));
    assert.ok(withWeb.includes("web_fetch"));
  });

  it("includes docker_image_lookup in agent tools (server denies for local)", () => {
    process.env.WEB_TOOLS_ENABLED = "false";
    const names = availableToolNames();
    assert.equal(names.includes("docker_image_lookup"), true);
    const agent = buildChatTools({ sessionId: "s1", mode: "agent" });
    assert.equal("docker_image_lookup" in agent, true);
  });

  it("buildTools filters to allowed names and skips unknown", () => {
    process.env.WEB_TOOLS_ENABLED = "false";
    const tools = buildTools({
      sessionId: "s1",
      allowed: ["read_file", "not_a_tool"]
    });
    assert.deepEqual(Object.keys(tools).sort(), ["read_file"]);
  });

  it("buildChatTools matches six-mode allow-lists", () => {
    process.env.WEB_TOOLS_ENABLED = "false";
    const ask = buildChatTools({ sessionId: "s1", mode: "ask" });
    assert.equal("read_file" in ask, true);
    assert.equal("preview_status" in ask, true);
    assert.equal("list_skills" in ask, true);
    assert.equal("write_file" in ask, false);
    assert.equal("delete_files" in ask, false);
    assert.equal("move_files" in ask, false);
    assert.equal("preview_start" in ask, false);
    assert.equal("upsert_launch_app" in ask, false);
    assert.equal("create_subtask" in ask, false);

    const plan = buildChatTools({ sessionId: "s1", mode: "plan" });
    assert.equal("preview_start" in plan, true);
    assert.equal("create_subtask" in plan, true);
    assert.equal("upsert_launch_app" in plan, true);
    assert.equal("write_file" in plan, false);
    assert.equal("run_terminal" in plan, false);

    const agent = buildChatTools({ sessionId: "s1", mode: "agent" });
    assert.equal("write_file" in agent, true);
    assert.equal("delete_files" in agent, true);
    assert.equal("move_files" in agent, true);
    assert.equal("run_terminal" in agent, true);
    assert.equal("preview_start" in agent, true);
    assert.equal("create_subtask" in agent, false);

    const debug = buildChatTools({ sessionId: "s1", mode: "debug" });
    assert.equal("write_file" in debug, true);
    assert.equal("create_subtask" in debug, false);

    const multi = buildChatTools({ sessionId: "s1", mode: "multitask" });
    assert.equal("write_file" in multi, true);
    assert.equal("create_subtask" in multi, true);

    const auto = buildChatTools({ sessionId: "s1", mode: "auto" });
    assert.equal("write_file" in auto, true);
    assert.equal("create_subtask" in auto, false);
    assert.equal("switch_mode" in auto, true);

    const legacy = buildChatTools({ sessionId: "s1", mode: "build" });
    assert.equal("write_file" in legacy, true);
  });

  it("executeNamedTool denies disallowed tools without forwarding", async () => {
    let forwarded = 0;
    globalThis.fetch = (async () => {
      forwarded += 1;
      return new Response(JSON.stringify({ success: true, output: "ok" }), {
        status: 200
      });
    }) as typeof fetch;
    const denied = await executeNamedTool({
      sessionId: "s",
      toolName: "write_file",
      args: { path: "a.ts", content: "x" },
      agentMode: "ask"
    });
    assert.equal(denied.success, false);
    assert.match(denied.output, /not available in ask mode/);
    assert.equal(forwarded, 0);

    const planShell = await executeNamedTool({
      sessionId: "s",
      toolName: "run_terminal",
      args: { command: "ls" },
      agentMode: "plan"
    });
    assert.equal(planShell.success, false);
    assert.equal(forwarded, 0);

    const devServer = await executeNamedTool({
      sessionId: "s",
      toolName: "run_terminal",
      args: { command: "npm run dev", workingDirectory: "portfolio" },
      agentMode: "agent"
    });
    assert.equal(devServer.success, false);
    assert.match(devServer.output, /preview_start/);
    assert.equal(forwarded, 0);

    const ok = await executeNamedTool({
      sessionId: "s",
      toolName: "write_file",
      args: { path: "a.ts", content: "x" },
      agentMode: "agent",
      turnId: "t1"
    });
    assert.equal(ok.success, true);
    assert.equal(forwarded, 1);
  });

  it("executeNamedTool forwards to tool-runner and parses JSON", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({ success: true, output: "ok", metadata: { a: 1 } }),
        { status: 200 }
      );
    }) as typeof fetch;
    const result = await executeNamedTool({
      sessionId: "sess",
      toolName: "read_file",
      args: { path: "a.ts" },
      turnId: "t1",
      agentMode: "agent"
    });
    assert.deepEqual(result, {
      success: true,
      output: "ok",
      metadata: { a: 1 }
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/internal\/tool-execute$/);
    const body = JSON.parse(String(calls[0]!.init?.body));
    assert.equal(body.sessionId, "sess");
    assert.equal(body.toolName, "read_file");
    assert.equal(body.turnId, "t1");
    assert.equal(body.agentMode, "agent");
  });

  it("executeNamedTool accepts ToolResult JSON on 4xx", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: false,
          output: "Provision failed: mongod missing",
          metadata: { recoverable: true }
        }),
        { status: 400 }
      )) as typeof fetch;
    const result = await executeNamedTool({
      sessionId: "s",
      toolName: "setup_project_infra",
      args: { engineId: "mongo", userApproved: true },
      agentMode: "agent"
    });
    assert.equal(result.success, false);
    assert.match(result.output, /mongod missing/);
  });

  it("executeNamedTool throws on non-ok and non-json", async () => {
    globalThis.fetch = (async () =>
      new Response("nope", { status: 500 })) as typeof fetch;
    await assert.rejects(
      () =>
        executeNamedTool({
          sessionId: "s",
          toolName: "read_file",
          args: {},
          agentMode: "agent"
        }),
      /tool-runner 500/
    );
    globalThis.fetch = (async () =>
      new Response("not-json", { status: 200 })) as typeof fetch;
    await assert.rejects(
      () =>
        executeNamedTool({
          sessionId: "s",
          toolName: "read_file",
          args: {},
          agentMode: "agent"
        }),
      /non-JSON/
    );
  });

  it("executeSwitchMode asks outside Auto and applies in Auto", () => {
    const ask = executeSwitchMode({
      currentMode: "agent",
      input: { target: "plan" }
    });
    assert.equal(ask.metadata?.applied, false);
    assert.match(ask.output, /Stop now and wait/);
    const auto = executeSwitchMode({
      currentMode: "auto",
      input: { target: "plan" }
    });
    assert.equal(auto.metadata?.applied, true);
    assert.equal(auto.metadata?.mode, "plan");
  });

  it("executeAskUser returns needsUserInput metadata for mcq and form", () => {
    const mcq = executeAskUser({
      kind: "mcq",
      prompt: "Provision Mongo?",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" }
      ]
    });
    assert.equal(mcq.metadata?.needsUserInput, true);
    assert.equal(mcq.metadata?.kind, "mcq");
    const form = executeAskUser({
      kind: "form",
      prompt: "Enter secrets",
      fields: [
        {
          id: "JWT_SECRET",
          label: "JWT secret",
          secret: true,
          value: "dev-jwt"
        }
      ]
    });
    assert.equal(form.metadata?.needsUserInput, true);
    assert.equal(form.metadata?.kind, "form");
    const fields = form.metadata?.fields as Array<{ value?: string }>;
    assert.equal(fields[0]?.value, "dev-jwt");
  });
});
