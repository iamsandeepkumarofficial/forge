import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("opens and shows menu items when the trigger is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSelect}>Rename</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    fireEvent.click(screen.getByText("Open menu"));
    await waitFor(() => {
      expect(screen.getByText("Actions")).toBeTruthy();
      expect(screen.getByText("Rename")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Rename"));
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalled();
    });
  });
});
