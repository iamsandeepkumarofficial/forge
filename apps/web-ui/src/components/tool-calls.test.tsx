import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolCalls } from "./tool-calls";

describe("ToolCalls", () => {
  it("renders an edit_file diff preview instead of raw JSON args", () => {
    render(
      <ToolCalls
        parts={[
          {
            type: "tool-invocation",
            toolCallId: "c1",
            toolName: "edit_file",
            args: {
              path: "src/main.ts",
              oldString: "foo",
              newString: "bar"
            },
            state: "result",
            output: "Successfully edited src/main.ts."
          }
        ]}
      />
    );
    expect(screen.getByText("Edited")).toBeTruthy();
    fireEvent.click(screen.getByText("Edited"));
    expect(screen.getByText(/Edit ·/)).toBeTruthy();
    expect(screen.getByText("-foo")).toBeTruthy();
    expect(screen.getByText("+bar")).toBeTruthy();
    expect(screen.queryByText(/"oldString"/)).toBeNull();
  });
  it("renders a write_file addition preview", () => {
    render(
      <ToolCalls
        parts={[
          {
            type: "tool-invocation",
            toolName: "write_file",
            args: { path: "hello.txt", content: "hello" },
            state: "result",
            output: "Wrote hello.txt"
          }
        ]}
      />
    );
    expect(screen.getByText("Wrote")).toBeTruthy();
    fireEvent.click(screen.getByText("Wrote"));
    expect(screen.getByText(/Write ·/)).toBeTruthy();
    expect(screen.getByText("+hello")).toBeTruthy();
  });

  it("opens a file path from the timeline", () => {
    const onOpenPath = vi.fn();
    render(
      <ToolCalls
        onOpenPath={onOpenPath}
        parts={[
          {
            type: "tool-invocation",
            toolName: "read_file",
            args: { path: "src/app.ts" },
            state: "result",
            output: "ok"
          }
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "app.ts" }));
    expect(onOpenPath).toHaveBeenCalledWith("src/app.ts");
  });

  it("does not show Show in terminal for background run_terminal jobs", () => {
    render(
      <ToolCalls
        parts={[
          {
            type: "tool-invocation",
            toolName: "run_terminal",
            args: { command: "pnpm test", background: true },
            state: "result",
            output: "Background job install is running.",
            metadata: { jobName: "install", running: true }
          }
        ]}
      />
    );
    expect(screen.getByText("Ran terminal")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Show in terminal" })
    ).toBeNull();
  });

  it("shows a glimpse of preview and upsert targets", () => {
    render(
      <ToolCalls
        parts={[
          {
            type: "tool-invocation",
            toolName: "preview_start",
            args: { name: "web" },
            state: "result",
            output: "Started web"
          },
          {
            type: "tool-invocation",
            toolName: "upsert_workspace_parameter",
            args: { key: "JWT_SECRET", value: "x" },
            state: "result",
            output: "ok"
          }
        ]}
      />
    );
    expect(screen.getByText("Started preview")).toBeTruthy();
    expect(screen.getByText("· web")).toBeTruthy();
    expect(screen.getByText("Upserted parameter")).toBeTruthy();
    expect(screen.getByText("· JWT_SECRET")).toBeTruthy();
  });

  it("starts expanded when defaultOpen is set", () => {
    render(
      <ToolCalls
        defaultOpen
        parts={[
          {
            type: "tool-invocation",
            toolName: "run_terminal",
            args: { command: "cat package.json" },
            state: "result",
            output: '{"name":"goodwillsandy"}'
          }
        ]}
      />
    );
    expect(screen.getByText("Ran terminal")).toBeTruthy();
    expect(
      (
        screen
          .getByText("Ran terminal")
          .closest("details") as HTMLDetailsElement
      ).open
    ).toBe(true);
    expect(screen.getByText('{"name":"goodwillsandy"}')).toBeTruthy();
  });
});
