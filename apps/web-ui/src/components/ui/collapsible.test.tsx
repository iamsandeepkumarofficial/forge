import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent
} from "./collapsible";

describe("Collapsible", () => {
  it("toggles content when the trigger is clicked", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Details</CollapsibleTrigger>
        <CollapsibleContent>Hidden body</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByText("Details")).toBeTruthy();
    fireEvent.click(screen.getByText("Details"));
    expect(screen.getByText("Hidden body")).toBeTruthy();
  });
});
