import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TaskLiveStream } from "./task-live-stream";

describe("TaskLiveStream", () => {
  it("renders nothing while the task is inactive", () => {
    const view = render(
      <TaskLiveStream sessionId="s" streamTurnId="t" active={false} />
    );
    expect(view.queryByTestId("task-live-stream")).toBeNull();
  });
});
