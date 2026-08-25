import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  SettingsPage,
  LLM_SETTINGS_KEY,
  loadLlmSettings,
  saveLlmSettings
} from "./settings";

describe("settings LLM storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips forge.settings.llm", () => {
    saveLlmSettings({
      openaiApiKey: "sk-o",
      anthropicApiKey: "sk-a",
      openaiCompatibleBaseUrl: "https://x/v1",
      openaiCompatibleApiKey: "k",
      openaiCompatibleModel: "m"
    });
    expect(localStorage.getItem(LLM_SETTINGS_KEY)).toBeTruthy();
    expect(loadLlmSettings().openaiApiKey).toBe("sk-o");
    expect(loadLlmSettings().openaiCompatibleModel).toBe("m");
  });
});

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("loads saved values and saves on submit", () => {
    saveLlmSettings({
      openaiApiKey: "existing",
      anthropicApiKey: "",
      openaiCompatibleBaseUrl: "",
      openaiCompatibleApiKey: "",
      openaiCompatibleModel: ""
    });
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    const openai = document.getElementById(
      "openaiApiKey"
    ) as HTMLInputElement;
    expect(openai.value).toBe("existing");
    fireEvent.change(openai, { target: { value: "sk-new" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(loadLlmSettings().openaiApiKey).toBe("sk-new");
    expect(screen.getByText("Saved")).toBeTruthy();
  });
});
