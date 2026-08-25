import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createRef } from "react";
import { ChatsComposerForm } from "./chats-composer-view";
import type { ChatsPageState } from "./use-chats-page";

vi.mock("../components/chat-composer.js", () => ({
  ModePicker: () => <div>ModePicker</div>,
  ModelPicker: () => <div>ModelPicker</div>
}));

const state = {
  prompt: "",
  setPrompt: vi.fn(),
  creating: false,
  textareaRef: createRef<HTMLTextAreaElement>(),
  startChat: vi.fn(),
  agentMode: "agent",
  setAgentMode: vi.fn(),
  provider: "openai-compatible",
  activeModel: "",
  autoModel: true,
  modelsByProvider: {},
  modelsLoading: false,
  setAutoModel: vi.fn(),
  onModelSelect: vi.fn(),
  projectId: "p1",
  setSearchParams: vi.fn()
} as unknown as ChatsPageState;

describe("ChatsComposerForm", () => {
  it("renders the composer controls", () => {
    render(
      <MemoryRouter>
        <ChatsComposerForm state={state} />
      </MemoryRouter>
    );
    expect(screen.getByText("ModePicker")).toBeTruthy();
  });
});
