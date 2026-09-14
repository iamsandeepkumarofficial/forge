import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AskUserChrome } from "./ask-user-chrome";

describe("AskUserChrome", () => {
  it("renders skip and close", () => {
    render(
      <AskUserChrome
        prompt="Choose"
        onSkip={() => undefined}
        onClose={() => undefined}
      >
        <p>body</p>
      </AskUserChrome>
    );
    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});
