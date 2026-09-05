import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AskUserPrompt } from "./ask-user-prompt";

describe("AskUserPrompt", () => {
  it("submits an mcq option and dismisses", () => {
    const onSubmit = vi.fn();
    const onDismiss = vi.fn();
    render(
      <AskUserPrompt
        proposal={{
          toolCallId: "t1",
          kind: "mcq",
          prompt: "Which database?",
          options: [
            { id: "pg", label: "Postgres" },
            { id: "mysql", label: "MySQL" }
          ],
          fields: []
        }}
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByTestId("ask-user-prompt")).toBeTruthy();
    expect(screen.getByText("Which database?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Postgres" }));
    expect(onSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("requires form fields before submit", () => {
    const onSubmit = vi.fn();
    render(
      <AskUserPrompt
        proposal={{
          toolCallId: "t2",
          kind: "form",
          prompt: "Provide credentials",
          options: [],
          fields: [{ id: "url", label: "Database URL" }]
        }}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      />
    );
    const submit = screen.getByRole("button", { name: "Submit" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "postgres://local" }
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { url: "postgres://local" }
      })
    );
  });
});
