import { describe, it, expect, vi } from "vitest";

vi.mock("./App", () => ({
  default: () => null
}));

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )
}));

describe("main", () => {
  it("throws when #root is missing", async () => {
    document.body.innerHTML = "";
    await expect(import("./main")).rejects.toThrow("#root missing");
  });

  it("mounts when #root exists", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
    vi.doMock("./App", () => ({
      default: () => null
    }));
    vi.doMock("@/components/theme-provider", () => ({
      ThemeProvider: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
      )
    }));
    await expect(import("./main")).resolves.toBeTruthy();
    expect(document.getElementById("root")).toBeTruthy();
  });
});
