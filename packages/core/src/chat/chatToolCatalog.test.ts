import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chatToolCatalogIds,
  formatToolDescription,
  getChatToolCatalogItem
} from "./chatToolCatalog.js";

describe("chatToolCatalog", () => {
  it("covers executed chat tools", () => {
    const ids = new Set(chatToolCatalogIds());
    for (const id of [
      "read_file",
      "write_file",
      "edit_file",
      "preview_start",
      "upsert_launch_app",
      "create_subtask",
      "web_search",
      "list_skills",
      "invoke_skill",
      "upsert_workspace_parameter",
      "docker_image_lookup",
      "provision_app_engine",
      "switch_mode",
      "ask_user"
    ]) {
      assert.equal(ids.has(id), true, id);
    }
    assert.equal(ids.has("git_clone"), false);
    assert.equal(ids.has("jira_get_ticket"), false);
  });

  it("formatToolDescription includes name, id, use and do-not", () => {
    const text = formatToolDescription("read_file");
    assert.match(text, /Read file \(read_file\)/);
    assert.match(text, /Use when:/);
    assert.match(text, /Do not use when:/);
  });

  it("run_terminal forbids long-running dev servers", () => {
    const item = getChatToolCatalogItem("run_terminal");
    assert.match(item?.negativeUsecases.join(" ") ?? "", /preview_start/);
    assert.match(item?.negativeUsecases.join(" ") ?? "", /time out/);
    assert.match(item?.description ?? "", /background:true/);
    assert.match(item?.description ?? "", /\/workspace/);
  });

  it("upsert_launch_app does not require user agreement", () => {
    const item = getChatToolCatalogItem("upsert_launch_app");
    assert.match(item?.description ?? "", /no user confirmation/);
    assert.match(item?.description ?? "", /3000–3009/);
    assert.doesNotMatch(item?.description ?? "", /agreed/);
  });

  it("preview_start requires port listening", () => {
    const item = getChatToolCatalogItem("preview_start");
    assert.match(item?.description ?? "", /listening/);
    assert.match(item?.description ?? "", /3000–3009/);
  });

  it("web tools require citation", () => {
    const search = getChatToolCatalogItem("web_search");
    const fetch = getChatToolCatalogItem("web_fetch");
    assert.match(search?.description ?? "", /https:\/\//);
    assert.match(fetch?.description ?? "", /https:\/\//);
  });
});
