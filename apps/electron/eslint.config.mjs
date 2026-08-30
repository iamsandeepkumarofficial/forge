import tseslint from "typescript-eslint";
import base from "../../eslint.base.mjs";

export default tseslint.config(...base, {
  ignores: ["src/preload.cjs"]
}, {
  files: ["**/*.{ts,tsx}"]
});
