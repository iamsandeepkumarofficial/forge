import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isGithubOAuthConfigured,
  webUiOrigin,
  signOAuthState,
  verifyOAuthState
} from "./githubOAuth.js";

const KEYS = [
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "FORGE_WEB_UI_ORIGIN",
  "WEB_UI_ORIGIN",
  "GITHUB_OAUTH_STATE_SECRET",
  "FORGE_POC_TOKEN"
] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

describe("githubOAuth helpers", () => {
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("isGithubOAuthConfigured requires both client id and secret", () => {
    assert.equal(isGithubOAuthConfigured(), false);
    process.env.GITHUB_CLIENT_ID = "id";
    assert.equal(isGithubOAuthConfigured(), false);
    process.env.GITHUB_CLIENT_SECRET = "secret";
    assert.equal(isGithubOAuthConfigured(), true);
  });

  it("webUiOrigin falls back to localhost vite default", () => {
    assert.equal(webUiOrigin(), "http://127.0.0.1:5173");
    process.env.WEB_UI_ORIGIN = "http://ui.example";
    assert.equal(webUiOrigin(), "http://ui.example");
    process.env.FORGE_WEB_UI_ORIGIN = "http://forge.ui";
    assert.equal(webUiOrigin(), "http://forge.ui");
  });

  it("signOAuthState / verifyOAuthState round-trip", () => {
    process.env.GITHUB_OAUTH_STATE_SECRET = "test-secret";
    const state = signOAuthState({
      userId: "user-1",
      nonce: "nonce-1",
      returnTo: "/projects"
    });
    const parsed = verifyOAuthState(state);
    assert.equal(parsed.userId, "user-1");
    assert.equal(parsed.nonce, "nonce-1");
    assert.equal(parsed.returnTo, "/projects");
  });

  it("verifyOAuthState rejects tampered signatures", () => {
    process.env.GITHUB_OAUTH_STATE_SECRET = "test-secret";
    const state = signOAuthState({ userId: "u", nonce: "n" });
    const [body] = state.split(".");
    assert.throws(() => verifyOAuthState(`${body}.tampered`), /signature/i);
    assert.throws(() => verifyOAuthState("not-valid"), /Invalid OAuth state/);
  });
});
