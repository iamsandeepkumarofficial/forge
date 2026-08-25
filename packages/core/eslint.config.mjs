import tseslint from "typescript-eslint";
import base from "../../eslint.base.mjs";

export default tseslint.config(...base, {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "forge-local/require-unit-test": "error",
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
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "express",
            message:
              "Constitution VI: @forge/core MUST NOT depend on HTTP frameworks."
          },
          {
            name: "react",
            message: "Constitution VI: @forge/core is backend domain only."
          },
          {
            name: "react-dom",
            message: "Constitution VI: @forge/core is backend domain only."
          },
          {
            name: "react-native",
            message: "Constitution VI: @forge/core is backend domain only."
          },
          {
            name: "@forge/fe-core",
            message:
              "Constitution VI: @forge/core MUST NOT depend on @forge/fe-core."
          },
          {
            name: "@forge/server",
            message:
              "Constitution VI: @forge/core MUST NOT import app adapters."
          },
          {
            name: "@forge/web-ui",
            message:
              "Constitution VI: @forge/core MUST NOT import app adapters."
          },
          {
            name: "@forge/orchestrator",
            message:
              "Constitution VI: deploy/runtime adapters stay outside @forge/core."
          },
          {
            name: "dockerode",
            message:
              "Constitution VI: deploy/runtime adapters stay outside @forge/core."
          },
          {
            name: "@kubernetes/client-node",
            message:
              "Constitution VI: deploy/runtime adapters stay outside @forge/core."
          }
        ],
        patterns: [
          {
            group: ["express/*", "express-*"],
            message:
              "Constitution VI: @forge/core MUST NOT depend on HTTP frameworks."
          },
          {
            group: ["@temporalio/worker", "@temporalio/worker/*"],
            message:
              "Constitution VI: Temporal worker bootstrap stays outside @forge/core."
          },
          {
            group: ["**/apps/**", "apps/*"],
            message: "Constitution VI: @forge/core MUST NOT import from apps/."
          }
        ]
      }
    ]
  }
});
