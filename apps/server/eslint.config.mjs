import tseslint from "typescript-eslint";
import base from "../../eslint.base.mjs";

export default tseslint.config(...base, {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@forge/fe-core",
            message:
              "Server adapters MUST NOT import client domain (@forge/fe-core)."
          },
          {
            name: "@forge/web-ui",
            message: "Server adapters MUST NOT import the web UI app."
          },
          {
            name: "@forge/ui",
            message: "Server adapters MUST NOT import @forge/ui."
          },
          {
            name: "react-dom",
            message: "Server adapters MUST NOT depend on react-dom."
          },
          {
            name: "react-native",
            message: "Server adapters MUST NOT depend on react-native."
          }
        ],
        patterns: [
          {
            group: ["**/apps/web-ui/**", "**/apps/mobile/**"],
            message: "Server adapters MUST NOT import client apps."
          }
        ]
      }
    ]
  }
});
