import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import noComments from "eslint-plugin-no-comments";
import tseslint from "typescript-eslint";
import forgeLocal from "./eslint-plugins/forge-local.mjs";

/**
 * Shared ESLint flat config for the Forge monorepo.
 * Apps and packages extend this via `import base from "../../eslint.base.mjs"`.
 *
 * Inspired in part by eslint-config-agent (AI-assisted maintainability):
 * size limits, require tests, ban suppressions, explicit types.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "packages/personas/**",
      "infra/**",
      "docker/**",
      "scripts/**",
      "**/*.d.ts",
      "**/*.config.ts",
      "**/*.config.mts",
      "**/*.config.js",
      "**/*.config.mjs",
      "eslint-plugins/**",
      "**/*.native.tsx",
      "**/*.native.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "no-comments": noComments,
      "@eslint-community/eslint-comments": eslintComments,
      "forge-local": forgeLocal
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    languageOptions: {
      parserOptions: {
        projectService: true
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "preserve-caught-error": "off",
      "no-comments/disallowComments": [
        "error",
        {
          allow: ["global"]
        }
      ],
      "@eslint-community/eslint-comments/no-use": [
        "error",
        {
          allow: []
        }
      ],
      "max-params": ["error", { max: 2 }],
      "no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 2, 3, 4],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
          enforceConst: true,
          detectObjects: false
        }
      ],
      "max-lines": [
        "error",
        {
          max: 400,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      "max-lines-per-function": [
        "error",
        {
          max: 80,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true
        }
      ],
      "forge-local/require-unit-test": "error"
    }
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-params": "off",
      "no-magic-numbers": "off",
      "forge-local/require-unit-test": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
