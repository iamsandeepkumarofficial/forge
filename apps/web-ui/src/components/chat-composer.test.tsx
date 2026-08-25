import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatComposer, AGENT_MODES } from "./chat-composer";

describe("ChatComposer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "",
        json: async () => ({ text: "" })
      }))
    );
  });

  it("exposes agent modes and sends from the composer", () => {
    expect(AGENT_MODES.some((m) => m.id === "agent")).toBe(true);
    const onSend = vi.fn();
    const onChange = vi.fn();
    render(
      <ChatComposer
        sessionId="s1"
        value="hello"
        onChange={onChange}
        onSend={onSend}
        onStop={vi.fn()}
        canSend
        status="ready"
        agentMode="agent"
        onAgentModeChange={vi.fn()}
        provider="openai"
        model="gpt-4o"
        autoModel={false}
        onAutoModelChange={vi.fn()}
        modelsByProvider={{
          openai: ["gpt-4o"],
          anthropic: [],
          "openai-compatible": []
        }}
        modelsLoading={false}
        onModelSelect={vi.fn()}
        conversationTokens={0}
        maxContextTokens={128000}
        maxOutputTokens={null}
        attachments={[]}
        onAttachFiles={vi.fn()}
        onRemoveAttachment={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText(/Plan, Build/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalled();
  });
});
