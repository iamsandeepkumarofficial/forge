import base from "../../eslint.base.mjs";

export default [
  ...base,
  {
    files: ["src/schema.ts"],
    rules: {
      "max-lines": [
        "error",
        { max: 700, skipBlankLines: true, skipComments: true }
      ]
    }
  }
];
