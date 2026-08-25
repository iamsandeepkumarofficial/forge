import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePendingModeSwitch } from "./use-pending-mode-switch";
import {
  MODE_SWITCH_TIMEOUT_MS,
  MODE_SWITCH_TIMEOUT_SECONDS
} from "../../lib/mode-switch";
import type { ToolPart } from "../../lib/tool-display";

function switchModePart(toolCallId: string, target: string): ToolPart {
  return {
    type: "tool-invocation",
    toolCallId,
    toolName: "switch_mode",
    state: "result",
    metadata: {
      applied: false,
      target,
      needsConfirmation: true
    }
  };
}

function flushCountdown(): void {
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

describe("usePendingModeSwitch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("confirms and dismisses pending proposals", () => {
    const onConfirm = vi.fn();
    const live = [switchModePart("c1", "ask")];
    const { result, rerender } = renderHook(
      ({ parts }) =>
        usePendingModeSwitch({
          messages: [],
          liveToolParts: parts,
          onConfirm
        }),
      { initialProps: { parts: live } }
    );
    flushCountdown();
    expect(result.current.pending?.target).toBe("ask");
    expect(result.current.remainingSeconds).toBe(MODE_SWITCH_TIMEOUT_SECONDS);
    act(() => {
      result.current.onConfirmModeSwitch();
    });
    expect(onConfirm).toHaveBeenCalledWith("ask");
    rerender({ parts: live });
    expect(result.current.pending).toBeNull();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("auto-dismisses after timeout without confirming", () => {
    const onConfirm = vi.fn();
    const live = [switchModePart("c1", "plan")];
    const { result } = renderHook(() =>
      usePendingModeSwitch({
        messages: [],
        liveToolParts: live,
        onConfirm
      })
    );
    flushCountdown();
    expect(result.current.pending?.target).toBe("plan");
    act(() => {
      vi.advanceTimersByTime(MODE_SWITCH_TIMEOUT_MS);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("dismiss clears timer so timeout does not fire later", () => {
    const onConfirm = vi.fn();
    const live = [switchModePart("c1", "debug")];
    const { result } = renderHook(() =>
      usePendingModeSwitch({
        messages: [],
        liveToolParts: live,
        onConfirm
      })
    );
    flushCountdown();
    act(() => {
      result.current.onDismissModeSwitch();
    });
    expect(result.current.pending).toBeNull();
    act(() => {
      vi.advanceTimersByTime(MODE_SWITCH_TIMEOUT_MS);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it("restarts timer for a new proposal", () => {
    const onConfirm = vi.fn();
    const first = [switchModePart("c1", "ask")];
    const second = [switchModePart("c2", "plan")];
    const { result, rerender } = renderHook(
      ({ parts }) =>
        usePendingModeSwitch({
          messages: [],
          liveToolParts: parts,
          onConfirm
        }),
      { initialProps: { parts: first } }
    );
    flushCountdown();
    expect(result.current.pending?.target).toBe("ask");
    act(() => {
      vi.advanceTimersByTime(MODE_SWITCH_TIMEOUT_MS / 2);
    });
    act(() => {
      result.current.onDismissModeSwitch();
    });
    rerender({ parts: second });
    flushCountdown();
    expect(result.current.pending?.target).toBe("plan");
    expect(result.current.remainingSeconds).toBe(MODE_SWITCH_TIMEOUT_SECONDS);
    act(() => {
      vi.advanceTimersByTime(MODE_SWITCH_TIMEOUT_MS / 2);
    });
    expect(result.current.pending?.target).toBe("plan");
    act(() => {
      vi.advanceTimersByTime(MODE_SWITCH_TIMEOUT_MS / 2);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });
});
