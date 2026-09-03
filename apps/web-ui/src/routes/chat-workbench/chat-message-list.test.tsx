import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessageList, looksLikePlan } from "./chat-message-list";

vi.mock("../../components/assistant-markdown.js", () => ({
  AssistantMarkdown: ({ text }: { text: string }) => <div>{text}</div>
}));
vi.mock("../../components/tool-calls.js", () => ({
  ToolCalls: () => <div>Tools</div>
}));

describe("ChatMessageList", () => {
  it("renders user and assistant messages", () => {
    const scrollerRef = createRef<HTMLDivElement | null>();
    const stickToBottomRef = { current: true };
    render(
      <ChatMessageList
        scrollerRef={scrollerRef}
        stickToBottomRef={stickToBottomRef}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[
          {
            id: "1",
            role: "user",
            parts: [{ type: "text", text: "Hello agent" }]
          },
          {
            id: "2",
            role: "assistant",
            parts: [{ type: "text", text: "Hi there" }]
          }
        ]}
        isStreaming={false}
        streamingText=""
        liveToolParts={[]}
        status="ready"
        error={null}
        clearError={vi.fn()}
      />
    );
    expect(screen.getByText("Hello agent")).toBeTruthy();
    expect(screen.getByText("Hi there")).toBeTruthy();
  });

  it("shows starters on an empty transcript", () => {
    const scrollerRef = createRef<HTMLDivElement | null>();
    const stickToBottomRef = { current: true };
    const onPickStarter = vi.fn();
    render(
      <ChatMessageList
        scrollerRef={scrollerRef}
        stickToBottomRef={stickToBottomRef}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[]}
        isStreaming={false}
        streamingText=""
        liveToolParts={[]}
        status="ready"
        error={null}
        clearError={vi.fn()}
        onPickStarter={onPickStarter}
      />
    );
    expect(screen.getByText("What should we work on?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explain this workspace" })).toBeTruthy();
  });

  it("shows thinking status after the latest message", () => {
    const scrollerRef = createRef<HTMLDivElement | null>();
    render(
      <ChatMessageList
        scrollerRef={scrollerRef}
        stickToBottomRef={{ current: true }}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[
          {
            id: "1",
            role: "user",
            parts: [{ type: "text", text: "Ship it" }]
          }
        ]}
        isStreaming
        streamingText=""
        liveToolParts={[]}
        status="submitted"
        error={null}
        clearError={vi.fn()}
      />
    );
    expect(screen.getByRole("status").textContent).toContain("Thinking");
  });

  it("shows running status while streaming", () => {
    const scrollerRef = createRef<HTMLDivElement | null>();
    render(
      <ChatMessageList
        scrollerRef={scrollerRef}
        stickToBottomRef={{ current: true }}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[
          {
            id: "1",
            role: "user",
            parts: [{ type: "text", text: "Ship it" }]
          }
        ]}
        isStreaming
        streamingText=""
        liveToolParts={[]}
        status="streaming"
        error={null}
        clearError={vi.fn()}
      />
    );
    expect(screen.getByRole("status").textContent).toContain("Running");
  });

  it("detects numbered plans", () => {
    expect(looksLikePlan("1. Install deps\n2. Start the app")).toBe(true);
    expect(looksLikePlan("Just a sentence.")).toBe(false);
  });
});
