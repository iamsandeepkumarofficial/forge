import { describe, it, expect } from "vitest";
import {
  askUserFormReply,
  askUserInitialValues,
  askUserMcqReply,
  findPendingAskUser,
  isWorkspaceParamFieldId,
  askUserSkipReply,
  askUserDisplayPrompt,
  groupAskUserFields
} from "./ask-user";
import type { ToolPart } from "./tool-display";

describe("ask-user", () => {
  it("findPendingAskUser returns the latest needsUserInput proposal", () => {
    const live: ToolPart[] = [
      {
        type: "tool-invocation",
        toolCallId: "a1",
        toolName: "ask_user",
        state: "result",
        metadata: {
          needsUserInput: true,
          kind: "mcq",
          prompt: "First?",
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" }
          ]
        }
      },
      {
        type: "tool-invocation",
        toolCallId: "a2",
        toolName: "ask_user",
        state: "result",
        metadata: {
          needsUserInput: true,
          kind: "form",
          prompt: "JWT?",
          fields: [
            {
              id: "JWT_SECRET",
              label: "JWT",
              secret: true,
              value: "dev-secret"
            }
          ]
        }
      }
    ];
    const pending = findPendingAskUser({
      messages: [],
      liveToolParts: live,
      dismissedIds: new Set()
    });
    expect(pending?.toolCallId).toBe("a2");
    expect(pending?.kind).toBe("form");
    expect(pending?.fields[0]?.value).toBe("dev-secret");
  });

  it("builds structured reply strings and initial values", () => {
    expect(askUserMcqReply({ id: "yes", label: "Yes, provision" })).toBe(
      'User answer (ask_user): chose "yes" — Yes, provision'
    );
    expect(
      askUserFormReply({
        fields: [{ id: "MONGODB_URL", label: "Mongo URL" }],
        values: { MONGODB_URL: "mongodb://x" },
        savedParamKeys: ["MONGODB_URL"]
      })
    ).toBe(
      "User answer (ask_user) — saved to parameter store: MONGODB_URL.\nMONGODB_URL: mongodb://x"
    );
    expect(
      askUserInitialValues([
        { id: "NODE_ENV", label: "Env", value: "development" },
        { id: "EMPTY", label: "Empty" }
      ])
    ).toEqual({ NODE_ENV: "development", EMPTY: "" });
    expect(isWorkspaceParamFieldId("JWT_SECRET")).toBe(true);
    expect(isWorkspaceParamFieldId("provision_mongo")).toBe(false);
    expect(askUserSkipReply()).toBe("User answer (ask_user): skipped");
  });

  it("parses group and type on form fields and groups sections", () => {
    const pending = findPendingAskUser({
      messages: [],
      liveToolParts: [
        {
          type: "tool-invocation",
          toolCallId: "g1",
          toolName: "ask_user",
          state: "result",
          metadata: {
            needsUserInput: true,
            kind: "form",
            prompt: "Env?",
            fields: [
              {
                id: "NODE_ENV",
                label: "Env",
                group: "Environment",
                type: "text",
                value: "development"
              },
              {
                id: "JWT_SECRET",
                label: "JWT",
                group: "Secrets",
                type: "secret"
              },
              {
                id: "SETUP",
                label: "Setup DB",
                type: "boolean",
                value: "true"
              }
            ]
          }
        }
      ],
      dismissedIds: new Set()
    });
    expect(pending?.fields[0]).toMatchObject({
      group: "Environment",
      type: "text"
    });
    expect(pending?.fields[1]).toMatchObject({
      group: "Secrets",
      type: "secret"
    });
    expect(pending?.fields[2]).toMatchObject({ type: "boolean" });
    expect(
      groupAskUserFields(pending?.fields ?? []).map((s) => s.group)
    ).toEqual([null, "Environment", "Secrets"]);
  });

  it("collapses markdown table prompts to a short hint", () => {
    expect(
      askUserDisplayPrompt(
        "Set these keys.\n\n| Name | Example |\n| --- | --- |\n| A | 1 |"
      )
    ).toMatch(/Details in the fields below/);
  });

  it("hides ask_user after a User answer message in history", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant" as const,
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "c1",
            toolName: "ask_user",
            state: "result",
            metadata: {
              needsUserInput: true,
              kind: "form",
              prompt: "Env?",
              fields: [{ id: "NODE_ENV", label: "Env", value: "development" }]
            }
          }
        ]
      },
      {
        id: "u1",
        role: "user" as const,
        parts: [
          {
            type: "text",
            text: "User answer (ask_user) — saved to parameter store: NODE_ENV.\nNODE_ENV: development"
          }
        ]
      }
    ];
    expect(
      findPendingAskUser({
        messages,
        liveToolParts: [],
        dismissedIds: new Set()
      })
    ).toBeNull();
  });

  it("shows a newer ask_user after an older answer", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant" as const,
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "c1",
            toolName: "ask_user",
            state: "result",
            metadata: {
              needsUserInput: true,
              kind: "mcq",
              prompt: "Old?",
              options: [
                { id: "a", label: "A" },
                { id: "b", label: "B" }
              ]
            }
          }
        ]
      },
      {
        id: "u1",
        role: "user" as const,
        parts: [{ type: "text", text: 'User answer (ask_user): chose "a" — A' }]
      },
      {
        id: "a2",
        role: "assistant" as const,
        parts: [
          {
            type: "tool-invocation",
            toolCallId: "c2",
            toolName: "ask_user",
            state: "result",
            metadata: {
              needsUserInput: true,
              kind: "form",
              prompt: "New?",
              fields: [{ id: "JWT_SECRET", label: "JWT", value: "x" }]
            }
          }
        ]
      }
    ];
    const pending = findPendingAskUser({
      messages,
      liveToolParts: [],
      dismissedIds: new Set()
    });
    expect(pending?.toolCallId).toBe("c2");
  });
});
