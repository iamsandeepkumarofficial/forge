import { describe, it, expect } from "vitest";
import { ConnectProjectError } from "./shared.js";
import {
  parseApiErrorText,
  throwConnectMappedError,
  rethrowAsConnectError,
  CONNECT_ERROR_MAP,
  uploadErrorMap
} from "./project-errors.js";

describe("project-errors", () => {
  it("parseApiErrorText reads JSON error payloads", () => {
    const parsed = parseApiErrorText({
      errorText: JSON.stringify({ error: "boom", help: "try again" }),
      fallbackMessage: "Failed"
    });
    expect(parsed.errorMessage).toBe("boom");
    expect(parsed.errorCode).toBe("boom");
    expect(parsed.helpText).toBe("try again");
  });

  it("throwConnectMappedError uses the connect map", () => {
    expect(() =>
      throwConnectMappedError({
        errorMessage: "Project already connected",
        errorCode: "Project already connected",
        helpText: undefined,
        map: CONNECT_ERROR_MAP
      })
    ).toThrow(ConnectProjectError);
  });

  it("rethrowAsConnectError wraps unknown errors", () => {
    expect(() =>
      rethrowAsConnectError({
        error: new Error("offline"),
        prefix: "Failed to connect project"
      })
    ).toThrow(/offline/);
  });

  it("uploadErrorMap includes file-too-large help", () => {
    expect(uploadErrorMap("12 MB")["File too large"]?.code).toBe(
      "FILE_TOO_LARGE"
    );
  });
});
