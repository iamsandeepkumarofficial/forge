import fs from "node:fs";
import path from "node:path";

/**
 * Local ESLint plugin: require a sibling unit test for implementation files.
 * Accepts: foo.ts -> foo.test.ts | foo.test.tsx
 *          foo.tsx -> foo.test.tsx | foo.test.ts
 */
function hasSiblingTest(filename) {
  const dir = path.dirname(filename);
  const base = path.basename(filename);
  const extMatch = base.match(/^(.*)\.(tsx|ts)$/);
  if (!extMatch) return true;
  const stem = extMatch[1];
  const candidates = [
    path.join(dir, `${stem}.test.ts`),
    path.join(dir, `${stem}.test.tsx`),
    path.join(dir, `${stem}.spec.ts`),
    path.join(dir, `${stem}.spec.tsx`)
  ];
  return candidates.some((p) => fs.existsSync(p));
}

function shouldSkip(filename) {
  const normalized = filename.replace(/\\/g, "/");
  if (!/\.(ts|tsx)$/.test(normalized)) return true;
  if (/\.(test|spec)\.(ts|tsx)$/.test(normalized)) return true;
  if (/\.d\.ts$/.test(normalized)) return true;
  if (/\/index\.(ts|tsx)$/.test(normalized)) return true;
  if (/\/vite-env\.d\.ts$/.test(normalized)) return true;
  if (/\.config\.(ts|tsx|js|mjs)$/.test(normalized)) return true;
  if (/\/types\.ts$/.test(normalized)) return true;
  if (/\.types\.ts$/.test(normalized)) return true;
  if (/\/migrations\//.test(normalized)) return true;
  if (/\.stories\.(ts|tsx)$/.test(normalized)) return true;
  if (/\.native\.(ts|tsx)$/.test(normalized)) return true;
  return false;
}

const requireUnitTestRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a sibling .test/.spec file for each implementation module"
    },
    schema: [],
    messages: {
      missingTest:
        "Missing unit test for '{{file}}'. Add '{{hint}}' (Constitution: tests required)."
    }
  },
  create(context) {
    const filename = context.filename;
    if (shouldSkip(filename)) {
      return {};
    }
    return {
      Program(node) {
        if (hasSiblingTest(filename)) {
          return;
        }
        const base = path.basename(filename);
        const stem = base.replace(/\.(tsx|ts)$/, "");
        const hint = filename.endsWith(".tsx")
          ? `${stem}.test.tsx`
          : `${stem}.test.ts`;
        context.report({
          node,
          messageId: "missingTest",
          data: { file: base, hint }
        });
      }
    };
  }
};

export default {
  meta: { name: "forge-local", version: "1.0.0" },
  rules: {
    "require-unit-test": requireUnitTestRule
  }
};
