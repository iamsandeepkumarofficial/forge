import tseslint from "typescript-eslint";
import base from "../../eslint.base.mjs";

export default tseslint.config(
  ...base,
  {
    files: ["**/*.{ts,tsx}"]
  },
  {
    files: [
      "src/inspectPageHtml.ts",
      "src/inspectPageJs.ts",
      "src/inspectPageClear.ts"
    ],
    rules: {
      "max-lines": "off",
      "forge-local/require-unit-test": "off"
    }
  }
);
