import { describe, it, expect } from "vitest";
import {
  askUserFormReply,
  askUserInitialValues,
  askUserMcqReply,
  findPendingAskUser,
  isWorkspaceParamFieldId
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
      askUserFormReply(
        [{ id: "MONGODB_URL", label: "Mongo URL" }],
        { MONGODB_URL: "mongodb://x" },
        { savedParamKeys: ["MONGODB_URL"] }
      )
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
