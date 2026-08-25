import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

/**
 * React + TS hygiene for UI shells (`apps/web-ui`) and presentational
 * atoms (`packages/ui`).
 *
 * Note: `react/no-start-component-edit` is not a published rule; the
 * equivalent intent (no setState during render) is enforced via
 * `react-hooks/set-state-in-render` from react-hooks recommended-latest.
 * Sync setState-in-effect rules come from the same recommended-latest set
 * (not a separate reactEffects plugin).
 */
export default tseslint.config(
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.flat["recommended-latest"].rules,
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-render": "error",
      "react-hooks/set-state-in-effect": "error",
      "react/jsx-props-no-spreading": [
        "error",
        {
          html: "ignore",
          custom: "enforce",
          explicitSpread: "ignore"
        }
      ],
      "react/jsx-key": [
        "error",
        {
          checkFragmentShorthand: true
        }
      ],
      "unused-imports/no-unused-imports": "error",
      "max-depth": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      "@typescript-eslint/no-floating-promises": "error"
    }
  },
  {
    files: [
      "**/components/ui/**/*.{ts,tsx}",
      "**/packages/ui/src/**/*.{ts,tsx}"
    ],
    rules: {
      "react/jsx-props-no-spreading": "off"
    }
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "react/jsx-props-no-spreading": "off",
      "max-depth": "off",
      "max-nested-callbacks": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off"
    }
  }
);
