import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ApiRequestForm,
  ApiResponseView,
  EndpointList
} from "./api-explorer-panels";

describe("api-explorer-panels", () => {
  it("lists endpoints and picks one", () => {
    const onPick = vi.fn();
    render(
      <EndpointList
        ops={[
          { method: "GET", path: "/health", summary: "Liveness" },
          { method: "POST", path: "/users" }
        ]}
        scanning={false}
        activeKey="GET /health"
        onPick={onPick}
      />
    );
    expect(screen.getByText("Endpoints")).toBeTruthy();
    expect(screen.getByText("/health")).toBeTruthy();
    fireEvent.click(screen.getByText("/users"));
    expect(onPick).toHaveBeenCalledWith({ method: "POST", path: "/users" });
  });

  it("shows scanning and empty states", () => {
    const { rerender } = render(
      <EndpointList ops={[]} scanning activeKey="" onPick={() => undefined} />
    );
    expect(screen.getByText("Scanning routes…")).toBeTruthy();
    rerender(
      <EndpointList
        ops={[]}
        scanning={false}
        activeKey=""
        onPick={() => undefined}
      />
    );
    expect(screen.getByText(/No routes found/i)).toBeTruthy();
  });

  it("edits request fields and sends", () => {
    const onSend = vi.fn();
    const onMethod = vi.fn();
    const onPath = vi.fn();
    render(
      <ApiRequestForm
        method="GET"
        path="/health"
        headerText=""
        body=""
        busy={false}
        onMethod={onMethod}
        onPath={onPath}
        onHeaderText={() => undefined}
        onBody={() => undefined}
        onSend={onSend}
      />
    );
    fireEvent.change(screen.getByLabelText("Request path"), {
      target: { value: "/ready" }
    });
    expect(onPath).toHaveBeenCalledWith("/ready");
    fireEvent.change(screen.getByLabelText("HTTP method"), {
      target: { value: "POST" }
    });
    expect(onMethod).toHaveBeenCalledWith("POST");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("renders response and error views", () => {
    const { rerender } = render(<ApiResponseView error={null} result={null} />);
    expect(screen.getByText(/Pick an endpoint/i)).toBeTruthy();
    rerender(
      <ApiResponseView
        error={null}
        result={{
          status: 200,
          statusText: "OK",
          durationMs: 15,
          body: '{"ok":true}'
        }}
      />
    );
    expect(screen.getByText(/200 OK/)).toBeTruthy();
    expect(screen.getByText('{"ok":true}')).toBeTruthy();
    rerender(<ApiResponseView error="timeout" result={null} />);
    expect(screen.getByText("timeout")).toBeTruthy();
  });
});
