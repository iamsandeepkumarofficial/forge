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
    expect(screen.getByText("edit_file")).toBeTruthy();
    expect(screen.getByText(/Edit preview/)).toBeTruthy();
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
    expect(screen.getByText(/Write preview/)).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "src/app.ts" }));
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
    expect(screen.getByText("run_terminal")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Show in terminal" })
    ).toBeNull();
  });
});
