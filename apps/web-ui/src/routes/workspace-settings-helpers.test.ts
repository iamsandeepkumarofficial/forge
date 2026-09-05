import { describe, it, expect } from "vitest";
import {
  fromRouteRows,
  newRouteKey,
  sourceLabel,
  toRouteRows
} from "./workspace-settings-helpers";

describe("workspace-settings-helpers", () => {
  it("maps source labels", () => {
    expect(sourceLabel("github")).toBe("GitHub");
    expect(sourceLabel("local")).toBe("Local");
    expect(sourceLabel("upload")).toBe("Upload");
    expect(sourceLabel("other")).toBe("other");
  });

  it("creates route keys and round-trips rows", () => {
    const key = newRouteKey();
    expect(key.startsWith("route-")).toBe(true);
    const rows = toRouteRows([
      { pathPrefix: "/api", target: "backend", stripPrefix: true },
      { pathPrefix: "/", target: "web" }
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.key.startsWith("route-")).toBe(true);
    expect(fromRouteRows(rows)).toEqual([
      { pathPrefix: "/api", target: "backend", stripPrefix: true },
      { pathPrefix: "/", target: "web" }
    ]);
  });
});
