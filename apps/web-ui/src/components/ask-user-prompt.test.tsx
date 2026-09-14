import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AskUserPrompt } from "./ask-user-prompt";

describe("AskUserPrompt", () => {
  it("submits an mcq option and closes", () => {
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
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Postgres" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('chose "pg"')
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("skips with a chat reply", () => {
    const onSubmit = vi.fn();
    render(
      <AskUserPrompt
        proposal={{
          toolCallId: "t1",
          kind: "mcq",
          prompt: "Continue?",
          options: [
            { id: "yes", label: "Yes" },
            { id: "no", label: "No" }
          ],
          fields: []
        }}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSubmit).toHaveBeenCalledWith({
      text: "User answer (ask_user): skipped"
    });
  });

  it("submits Other custom text", () => {
    const onSubmit = vi.fn();
    render(
      <AskUserPrompt
        proposal={{
          toolCallId: "t1",
          kind: "mcq",
          prompt: "Which host?",
          options: [
            { id: "local", label: "Local" },
            { id: "remote", label: "Remote" }
          ],
          fields: []
        }}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Other answer" }), {
      target: { value: "staging.example" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledWith({
      text: "User answer (ask_user): other — staging.example"
    });
  });

  it("requires form fields before submit and groups them", () => {
    const onSubmit = vi.fn();
    render(
      <AskUserPrompt
        proposal={{
          toolCallId: "t2",
          kind: "form",
          prompt: "Provide credentials",
          options: [],
          fields: [
            {
              id: "url",
              label: "Database URL",
              group: "Environment"
            }
          ]
        }}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText("Environment")).toBeTruthy();
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

  it("renders boolean fields as Yes/No", () => {
    const onSubmit = vi.fn();
    render(
      <AskUserPrompt
        proposal={{
          toolCallId: "t3",
          kind: "form",
          prompt: "Setup?",
          options: [],
          fields: [
            {
              id: "provision_mongo",
              label: "Provision MongoDB",
              type: "boolean",
              value: "true"
            }
          ]
        }}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Yes" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { provision_mongo: "true" }
      })
    );
  });

  it("collapses markdown table prompts", () => {
    render(
      <AskUserPrompt
        proposal={{
          toolCallId: "t4",
          kind: "form",
          prompt:
            "Fill env vars.\n\n| Key | Value |\n| --- | --- |\n| FOO | bar |",
          options: [],
          fields: [{ id: "FOO", label: "Foo", value: "bar" }]
        }}
        onSubmit={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText(/Details in the fields below/)).toBeTruthy();
    expect(screen.queryByText("| Key | Value |")).toBeNull();
  });
});
