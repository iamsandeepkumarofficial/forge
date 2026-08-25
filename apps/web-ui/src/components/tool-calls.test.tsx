import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
