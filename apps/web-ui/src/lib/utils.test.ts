import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    const skip = false;
    expect(cn("text-sm", skip && "hidden", "font-medium")).toBe(
      "text-sm font-medium"
    );
  });
});
