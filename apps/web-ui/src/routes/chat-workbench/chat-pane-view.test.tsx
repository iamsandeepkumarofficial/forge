import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatPaneView } from "./chat-pane-view";

vi.mock("../../components/chat-composer.js", () => ({
  ChatComposer: () => <div>composer</div>
}));
vi.mock("./chat-message-list.js", () => ({
  ChatMessageList: () => <div>messages</div>
}));

describe("ChatPaneView", () => {
  it("renders message list and composer", () => {
    render(
      <ChatPaneView
        sessionId="s1"
        projectId="p1"
        chatId="c1"
        sessionKind="ticket"
        scrollerRef={{ current: null }}
        stickToBottomRef={{ current: true }}
        messages={[]}
        isStreaming={false}
        streamingText=""
        liveToolParts={[]}
        status="ready"
        error={null}
        clearError={vi.fn()}
        lastUserIndex={-1}
        input=""
        setInput={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        canSend={false}
        agentMode="agent"
        onAgentModeChange={vi.fn()}
        provider="openai"
        model="gpt-4o"
        autoModel={false}
        onAutoModelChange={vi.fn()}
        modelsByProvider={{}}
        modelsLoading={false}
        onModelSelect={vi.fn()}
        conversationTokens={0}
        maxContextTokens={null}
        maxOutputTokens={null}
        attachments={[]}
        onAttachFiles={vi.fn()}
        onRemoveAttachment={vi.fn()}
      />
    );
    expect(screen.getByText("messages")).toBeTruthy();
    expect(screen.getByText("composer")).toBeTruthy();
  });
});
