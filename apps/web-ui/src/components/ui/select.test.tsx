import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./select";

describe("Select", () => {
  it("renders a trigger and opens options", async () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger aria-label="Pick">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByRole("combobox", { name: "Pick" });
    expect(trigger.getAttribute("data-slot")).toBe("select-trigger");
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByText("Beta")).toBeTruthy();
    });
  });
});
