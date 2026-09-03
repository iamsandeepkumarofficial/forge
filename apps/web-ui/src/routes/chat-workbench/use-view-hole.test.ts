import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { useViewHole } from "./use-view-hole";

describe("useViewHole", () => {
  it("hides the view when inactive", () => {
    const setBounds = vi.fn(async () => undefined);
    const setVisible = vi.fn(async () => undefined);
    const ref = createRef<HTMLDivElement>();
    renderHook(() =>
      useViewHole({ ref, active: false, setBounds, setVisible })
    );
    expect(setVisible).toHaveBeenCalledWith(false);
    expect(setBounds).not.toHaveBeenCalled();
  });
});
