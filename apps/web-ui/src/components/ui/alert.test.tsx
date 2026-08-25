import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert, AlertTitle, AlertDescription, AlertAction } from "./alert";

describe("Alert", () => {
  it("renders role=alert with title and description", () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something happened</AlertDescription>
        <AlertAction>Dismiss</AlertAction>
      </Alert>
    );
    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("data-slot")).toBe("alert");
    expect(screen.getByText("Heads up")).toBeTruthy();
    expect(screen.getByText("Something happened")).toBeTruthy();
    expect(screen.getByText("Dismiss")).toBeTruthy();
  });

  it("applies destructive variant classes", () => {
    render(<Alert variant="destructive">Error</Alert>);
    expect(screen.getByRole("alert").className).toContain("text-destructive");
  });
});
