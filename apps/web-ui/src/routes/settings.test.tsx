import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/settings/llm")) {
          if (method === "PUT") {
            return new Response(init?.body ? String(init.body) : "{}", {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response("not found", { status: 404 });
      })
    );
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("loads saved values and saves on submit", async () => {
    saveLlmSettings({
      openaiApiKey: "existing",
      anthropicApiKey: "",
      openaiCompatibleBaseUrl: "https://example.com/v1",
      openaiCompatibleApiKey: "",
      openaiCompatibleModel: "m1"
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
    await waitFor(() => expect(openai.value).toBe("existing"));
    fireEvent.change(openai, { target: { value: "sk-new" } });
    fireEvent.submit(openai.closest("form")!);
    await waitFor(() =>
      expect(loadLlmSettings().openaiApiKey).toBe("sk-new")
    );
    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            String(call[0]).includes("/api/settings/llm") &&
            (call[1]?.method ?? "").toUpperCase() === "PUT"
        )
      ).toBe(true);
    });
  });
});
