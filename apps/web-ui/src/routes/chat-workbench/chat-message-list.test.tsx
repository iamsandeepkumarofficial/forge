import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChatMessageList, looksLikePlan } from "./chat-message-list";

vi.mock("../../components/assistant-markdown.js", () => ({
  AssistantMarkdown: ({ text }: { text: string }) => <div>{text}</div>
}));
vi.mock("../../components/tool-calls.js", () => ({
  ToolCalls: ({ defaultOpen }: { defaultOpen?: boolean }) => (
    <div>{defaultOpen ? "Tools expanded" : "Tools"}</div>
  )
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
    expect(
      screen.getByRole("button", { name: "Explain this workspace" })
    ).toBeTruthy();
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
    expect(screen.queryByText("…")).toBeNull();
  });

  it("renders persisted reasoning on assistant messages", () => {
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
            id: "2",
            role: "assistant",
            parts: [
              { type: "reasoning", text: "step by step" },
              { type: "text", text: "Done" }
            ]
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
    expect(screen.getByRole("button", { name: /thought/i })).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.queryByText("step by step")).toBeNull();
  });

  it("keeps thinking expanded when assistant text is empty", () => {
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
            id: "2",
            role: "assistant",
            parts: [{ type: "reasoning", text: "I already have the content." }]
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
    expect(screen.getByText("I already have the content.")).toBeTruthy();
  });

  it("keeps tool cards expanded when assistant text is empty", () => {
    render(
      <ChatMessageList
        scrollerRef={createRef<HTMLDivElement | null>()}
        stickToBottomRef={{ current: true }}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[
          {
            id: "2",
            role: "assistant",
            parts: [
              {
                type: "tool-invocation",
                toolCallId: "t1",
                toolName: "run_terminal",
                args: { command: "cat package.json" },
                state: "result",
                output: '{"name":"goodwillsandy"}'
              }
            ]
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
    expect(screen.getByText("Tools expanded")).toBeTruthy();
  });

  it("detects numbered plans", () => {
    expect(looksLikePlan("1. Install deps\n2. Start the app")).toBe(true);
    expect(looksLikePlan("Just a sentence.")).toBe(false);
  });

  it("shows assistant copy and branch actions", () => {
    const scrollerRef = createRef<HTMLDivElement | null>();
    const onBranchAssistant = vi.fn();
    render(
      <ChatMessageList
        scrollerRef={scrollerRef}
        stickToBottomRef={{ current: true }}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[
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
        onBranchAssistant={onBranchAssistant}
      />
    );
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Branch chat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Branch chat" }));
    expect(onBranchAssistant).toHaveBeenCalledWith({
      messageId: "2",
      text: "Hi there"
    });
  });

  it("shows copy and branch once per run, not per llm step", () => {
    const onBranchAssistant = vi.fn();
    render(
      <ChatMessageList
        scrollerRef={createRef<HTMLDivElement | null>()}
        stickToBottomRef={{ current: true }}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Fix it" }]
          },
          {
            id: "a1",
            role: "assistant",
            parts: [
              { type: "text", text: "I'll inspect the files." },
              {
                type: "tool-invocation",
                toolCallId: "t1",
                toolName: "read_file"
              }
            ]
          },
          {
            id: "a2",
            role: "assistant",
            parts: [{ type: "text", text: "Patched." }]
          },
          {
            id: "u2",
            role: "user",
            parts: [{ type: "text", text: "Thanks" }]
          },
          {
            id: "a3",
            role: "assistant",
            parts: [{ type: "text", text: "Anytime." }]
          }
        ]}
        isStreaming={false}
        streamingText=""
        liveToolParts={[]}
        status="ready"
        error={null}
        clearError={vi.fn()}
        onBranchAssistant={onBranchAssistant}
      />
    );
    expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Branch chat" })).toHaveLength(
      2
    );
    expect(
      screen.getAllByRole("button", { name: "More actions" })
    ).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Branch chat" })[0]!);
    expect(onBranchAssistant).toHaveBeenCalledWith({
      messageId: "a2",
      text: "I'll inspect the files.\n\nPatched."
    });
  });

  it("hides run actions on the in-progress turn", () => {
    render(
      <ChatMessageList
        scrollerRef={createRef<HTMLDivElement | null>()}
        stickToBottomRef={{ current: true }}
        sessionKind="workbench"
        projectId="p1"
        chatId="c1"
        messages={[
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Fix it" }]
          },
          {
            id: "a1",
            role: "assistant",
            parts: [{ type: "text", text: "Working" }]
          }
        ]}
        isStreaming
        streamingText="still going"
        liveToolParts={[]}
        status="streaming"
        error={null}
        clearError={vi.fn()}
        onBranchAssistant={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Branch chat" })).toBeNull();
  });

  it("opens edit mode from undo and confirms revert", () => {
    const scrollerRef = createRef<HTMLDivElement | null>();
    const onRevertUserMessage = vi.fn();
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
            parts: [{ type: "text", text: "Hello agent" }]
          }
        ]}
        isStreaming={false}
        streamingText=""
        liveToolParts={[]}
        status="ready"
        error={null}
        clearError={vi.fn()}
        onRevertUserMessage={onRevertUserMessage}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const editor = screen.getByLabelText("Edit message");
    fireEvent.change(editor, { target: { value: "Hello again" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const dialog = screen.getByRole("dialog", { name: "Revert this chat?" });
    expect(dialog).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Revert back" }));
    expect(onRevertUserMessage).toHaveBeenCalledWith({
      messageId: "1",
      text: "Hello again"
    });
  });
});
