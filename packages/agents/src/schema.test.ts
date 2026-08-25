import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { agentSchema, parseAgent } from "./schema.js";

const validYaml = `
id: sample-agent
name: Sample Agent
category: coding
description: Helps with coding tasks.
tools:
  - read_file
skills:
  - refactor
systemPrompt: You are a helpful coding agent.
`;

describe("parseAgent", () => {
  it("parses a valid agent definition", () => {
    const agent = parseAgent(validYaml);
    assert.equal(agent.id, "sample-agent");
    assert.equal(agent.name, "Sample Agent");
    assert.equal(agent.category, "coding");
    assert.deepEqual(agent.tools, ["read_file"]);
    assert.deepEqual(agent.skills, ["refactor"]);
    assert.match(agent.systemPrompt, /helpful coding agent/);
  });

  it("defaults tools and skills to empty arrays", () => {
    const agent = parseAgent(`
id: minimal
name: Minimal
description: Minimal agent.
systemPrompt: Be brief.
`);
    assert.deepEqual(agent.tools, []);
    assert.deepEqual(agent.skills, []);
  });

  it("rejects missing required fields", () => {
    assert.throws(
      () => parseAgent("id: incomplete\nname: Only Name\n"),
      ZodError
    );
  });

  it("rejects invalid category values", () => {
    assert.throws(
      () =>
        parseAgent(`
id: bad-cat
name: Bad
category: not-a-category
description: x
systemPrompt: y
`),
      ZodError
    );
  });
});

describe("agentSchema", () => {
  it("accepts optional model and webBudgets", () => {
    const parsed = agentSchema.parse({
      id: "with-model",
      name: "With Model",
      description: "Has model settings",
      systemPrompt: "Prompt",
      model: { provider: "openai", name: "gpt-4o" },
      webBudgets: { maxSearches: 3, maxFetches: 2 }
    });
    assert.equal(parsed.model?.provider, "openai");
    assert.equal(parsed.webBudgets?.maxSearches, 3);
  });
});
