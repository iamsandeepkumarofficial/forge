import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLongRunningDevServerCommand,
  longRunningDevServerDeniedMessage
} from "./devServerCommand.js";

describe("devServerCommand", () => {
  it("detects package-manager and framework dev servers", () => {
    for (const cmd of [
      "npm run dev",
      "pnpm dev",
      "yarn start",
      "bun run serve",
      "npx vite dev",
      "next dev",
      "npx next dev --port 3000",
      "nodemon src/index.js",
      "tsx watch src/server.ts"
    ]) {
      assert.equal(isLongRunningDevServerCommand(cmd), true, cmd);
    }
  });

  it("allows one-shot commands", () => {
    for (const cmd of [
      "npm test",
      "pnpm typecheck",
      "npm run build",
      "npx playwright screenshot https://example.com tmp/x.png",
      "ls"
    ]) {
      assert.equal(isLongRunningDevServerCommand(cmd), false, cmd);
    }
  });

  it("denied message points at preview_start", () => {
    assert.match(longRunningDevServerDeniedMessage(), /preview_start/);
    assert.match(longRunningDevServerDeniedMessage(), /upsert_launch_app/);
  });
});
