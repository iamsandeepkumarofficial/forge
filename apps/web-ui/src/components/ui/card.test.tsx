import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction
} from "./card";

describe("Card", () => {
  it("renders composed card sections", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
          <CardDescription>Summary</CardDescription>
          <CardAction>Go</CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(document.querySelector('[data-slot="card"]')).toBeTruthy();
    expect(screen.getByText("Project")).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("Go")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });

  it("sets data-size for the sm size", () => {
    render(<Card size="sm">Small</Card>);
    expect(
      document.querySelector('[data-slot="card"]')?.getAttribute("data-size")
    ).toBe("sm");
  });
});
