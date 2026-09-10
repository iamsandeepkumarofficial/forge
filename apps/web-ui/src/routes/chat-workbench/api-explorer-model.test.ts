import { describe, it, expect } from "vitest";
import {
  apiBaseUrl,
  formatResponseBody,
  mergeOperations,
  operationsFromOpenApi,
  parseHeaderLines,
  previewPortLabel
} from "./api-explorer-model";

describe("api-explorer helpers", () => {
  it("shows only the port in the preview selector", () => {
    expect(previewPortLabel({ name: "bp-backend", port: 3000 })).toBe("3000");
    expect(
      previewPortLabel({ name: "bp-frontend", port: 3000, hostPort: 40007 })
    ).toBe("40007");
    expect(previewPortLabel({ name: "worker" })).toBe("worker");
  });

  it("parses header lines and formats json bodies", () => {
    expect(
      parseHeaderLines("Authorization: Bearer x\nAccept: application/json")
    ).toEqual({
      Authorization: "Bearer x",
      Accept: "application/json"
    });
    expect(formatResponseBody('{"ok":true}')).toBe('{\n  "ok": true\n}');
    expect(formatResponseBody("not-json")).toBe("not-json");
  });

  it("reads OpenAPI paths into a picker list", () => {
    const ops = operationsFromOpenApi({
      paths: {
        "/health": { get: { summary: "Liveness" } },
        "/users": { post: { summary: "Create" }, get: {} }
      }
    });
    expect(ops).toEqual([
      { method: "GET", path: "/health", summary: "Liveness" },
      { method: "GET", path: "/users", summary: undefined },
      { method: "POST", path: "/users", summary: "Create" }
    ]);
  });

  it("merges discovered operations without duplicates", () => {
    expect(
      mergeOperations(
        [{ method: "GET", path: "/health" }],
        [
          { method: "GET", path: "/health" },
          { method: "POST", path: "/users" }
        ]
      )
    ).toEqual([
      { method: "GET", path: "/health" },
      { method: "POST", path: "/users" }
    ]);
  });

  it("prefers the live url for the address bar", () => {
    expect(
      apiBaseUrl({
        url: "http://p3000.preview.localhost/",
        hostPort: 13000,
        port: 3000
      })
    ).toBe("http://p3000.preview.localhost/");
  });
});
