import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssistantMarkdown } from "./assistant-markdown";

describe("AssistantMarkdown", () => {
  it("renders markdown headings and links", () => {
    render(
      <AssistantMarkdown
        text={"## Hello\n\nSee [docs](https://example.com)."}
      />
    );
    expect(screen.getByRole("heading", { name: "Hello" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "docs" });
    expect(link.getAttribute("href")).toBe("https://example.com");
  });

  it("renders fenced code", () => {
    render(<AssistantMarkdown text={"```ts\nconst x = 1\n```"} />);
    expect(screen.getByText("const x = 1")).toBeTruthy();
  });
});
