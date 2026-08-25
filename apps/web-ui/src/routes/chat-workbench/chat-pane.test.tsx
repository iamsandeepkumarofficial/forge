import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChatPane } from "./chat-pane";

vi.mock("../../lib/chat-agent.js", () => ({
  fetchModels: async () => ["gpt-4o"],
  fetchModelTokenLimits: async () => ({
    contextWindow: 128000,
    maxOutputTokens: null
  }),
  fetchSessionMessages: async () => [],
  cancelChatTurn: async () => undefined
}));
vi.mock("../../components/chat-composer.js", () => ({
  AGENT_MODES: [
    {
      id: "agent",
      label: "Agent",
      chatMode: "agent",
      enabled: true,
      icon: () => null
    }
  ],
  ALL_PROVIDERS: ["openai"],
  ChatComposer: () => <div>Composer</div>
}));
vi.mock("./chat-message-list.js", () => ({
  ChatMessageList: () => <div>Messages</div>
}));
vi.mock("./chat-pane-send.js", () => ({
  runChatSend: vi.fn(),
  readAttachmentsAsText: async () => "",
  applyStreamToolEvent: (options: { prev: unknown[] }) => options.prev
}));

describe("ChatPane", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders message list and composer", async () => {
    render(
      <MemoryRouter>
        <ChatPane
          sessionId="s1"
          projectId="p1"
          chatId="c1"
          sessionKind="workbench"
        />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Messages")).toBeTruthy();
      expect(screen.getByText("Composer")).toBeTruthy();
    });
  });
});
