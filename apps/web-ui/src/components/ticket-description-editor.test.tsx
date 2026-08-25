import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { TicketDescriptionEditor } from "./ticket-description-editor";

vi.mock("./use-ticket-description-editor.js", () => ({
  useTicketDescriptionEditor: () => ({ editor: null, save: vi.fn() })
}));

describe("TicketDescriptionEditor", () => {
  it("renders nothing without an editor", () => {
    const { container } = render(
      <TicketDescriptionEditor projectId="p1" chatId="c1" description={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});
