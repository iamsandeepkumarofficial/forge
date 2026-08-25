import tseslint from "typescript-eslint";
import base from "../../eslint.base.mjs";
import react from "../../eslint.react.mjs";

export default tseslint.config(...base, ...react, {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@forge/server",
            message:
              "Web UI MUST call the HTTP API; do not import @forge/server."
          },
          {
            name: "@forge/orchestrator",
            message: "Web UI MUST NOT import the Temporal orchestrator package."
          },
          {
            name: "@forge/db",
            message: "Web UI MUST NOT import database packages; use the API."
          },
          {
            name: "express",
            message: "Web UI MUST NOT depend on Express."
          },
          {
            name: "dockerode",
            message: "Web UI MUST NOT depend on Docker runtime adapters."
          },
          {
            name: "@kubernetes/client-node",
            message: "Web UI MUST NOT depend on Kubernetes clients."
          }
        ],
        patterns: [
          {
            group: ["**/apps/server/**", "**/packages/orchestrator/**"],
            message: "Web UI MUST NOT import server/orchestrator internals."
          }
        ]
      }
    ]
  }
});
