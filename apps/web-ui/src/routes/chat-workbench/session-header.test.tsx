import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionHeader } from "./session-header";

describe("SessionHeader", () => {
  it("shows title and turn status without a preview url", () => {
    render(
      <SessionHeader
        onBack={vi.fn()}
        title="Add auth"
        turnStatus="running"
        sandboxStatus="ready"
        leftMode="chat"
        onLeftMode={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Add auth" })).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.queryByText(/preview.localhost/)).toBeNull();
    expect(screen.queryByText("Starting sandbox")).toBeNull();
    expect(screen.queryByText("← Chats")).toBeNull();
  });

  it("selects left-pane modes from the top-left cluster", () => {
    const onLeftMode = vi.fn();
    render(
      <SessionHeader
        onBack={vi.fn()}
        title="Chat"
        turnStatus="idle"
        sandboxStatus="ready"
        leftMode="chat"
        onLeftMode={onLeftMode}
      />
    );
    expect(screen.getByRole("heading", { name: "Chat" })).toBeTruthy();
    expect(screen.getByLabelText("Idle")).toBeTruthy();
    expect(screen.queryByText("Idle")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Files" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Changes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Help" })).toBeTruthy();
    screen.getByRole("button", { name: "Files" }).click();
    expect(onLeftMode).toHaveBeenCalledWith("files");
  });

  it("shows a solid red leave control on the top right", () => {
    render(
      <SessionHeader
        onBack={vi.fn()}
        title="Chat"
        turnStatus="idle"
        sandboxStatus="ready"
        leftMode="chat"
        onLeftMode={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Leave session" })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Leave session" })
    ).toHaveLength(1);
  });

  it("asks before leaving the session", () => {
    const onBack = vi.fn();
    render(
      <SessionHeader
        onBack={onBack}
        title="Chat"
        turnStatus="idle"
        sandboxStatus="ready"
        leftMode="chat"
        onLeftMode={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Leave session" }));
    expect(screen.getByText("Leave this session?")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.queryByText("Leave this session?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Leave session" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows sandbox starting and waiting", () => {
    render(
      <SessionHeader
        onBack={vi.fn()}
        title="Chat"
        turnStatus="waiting"
        sandboxStatus="starting"
        leftMode="chat"
        onLeftMode={vi.fn()}
      />
    );
    expect(screen.getByText("Waiting on you")).toBeTruthy();
    expect(screen.getByText("Starting sandbox")).toBeTruthy();
  });
});
