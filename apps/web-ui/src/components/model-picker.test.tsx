import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelPicker } from "./model-picker";

describe("ModelPicker", () => {
  it("opens and lists models for selection", () => {
    const onSelect = vi.fn();
    render(
      <ModelPicker
        provider="openai"
        model="gpt-4o"
        auto={false}
        modelsByProvider={{ openai: ["gpt-4o", "o1"] }}
        loading={false}
        onAutoChange={vi.fn()}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("gpt-4o"));
    expect(screen.getByPlaceholderText(/Search models/i)).toBeTruthy();
    fireEvent.click(screen.getByText("o1"));
    expect(onSelect).toHaveBeenCalledWith("openai", "o1");
  });
});
