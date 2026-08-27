import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ForgeMark, ForgeMarkLink } from "./forge-mark";

describe("ForgeMark", () => {
  it("renders wordmark by default", () => {
    render(<ForgeMark />);
    expect(screen.getByText("Forge")).toBeTruthy();
  });

  it("hides wordmark when requested", () => {
    render(<ForgeMark showWordmark={false} />);
    expect(screen.queryByText("Forge")).toBeNull();
  });

  it("links home", () => {
    render(
      <MemoryRouter>
        <ForgeMarkLink />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("Forge home")).toBeTruthy();
  });
});
