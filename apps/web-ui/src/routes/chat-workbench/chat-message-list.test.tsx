import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessageList } from "./chat-message-list";

vi.mock("../../components/assistant-markdown.js", () => ({
  AssistantMarkdown: ({ text }: { text: string }) => <div>{text}</div>
}));
vi.mock("../../components/stage-pipeline-transcript.js", () => ({
  StagePipelineTranscript: () => <div>Pipeline</div>
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
        lastUserIndex={0}
      />
    );
    expect(screen.getByText("Hello agent")).toBeTruthy();
    expect(screen.getByText("Hi there")).toBeTruthy();
  });
});
