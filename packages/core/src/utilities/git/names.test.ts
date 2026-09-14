import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeRepoDirectoryName,
  deriveRepoDirectoryName,
  sanitizeRepoDirectoryName
} from "./names.js";

test("deriveRepoDirectoryName extracts repo leaf", () => {
  assert.equal(
    deriveRepoDirectoryName("https://github.com/acme/widgets.git"),
    "widgets"
  );
});

test("assertSafeRepoDirectoryName rejects path separators", () => {
  assert.throws(() => assertSafeRepoDirectoryName("../escape"));
});

test("sanitizeRepoDirectoryName strips punctuation and rejects empty", () => {
  assert.equal(sanitizeRepoDirectoryName("My App!"), "My-App");
  assert.equal(sanitizeRepoDirectoryName("  "), null);
  assert.equal(sanitizeRepoDirectoryName("../escape"), null);
});
