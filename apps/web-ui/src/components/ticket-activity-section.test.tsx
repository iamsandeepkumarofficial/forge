import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TicketActivitySection } from "@/components/ticket-activity-section";
vi.mock("@/lib/projects-api", () => ({
  getActivity: vi.fn()
}));
import { getActivity } from "@/lib/projects-api";
describe("TicketActivitySection", () => {
  beforeEach(() => {
    vi.mocked(getActivity).mockImplementation(async (options) => {
      const filter = options.filter ?? "all";
      if (filter === "history") {
        return {
          filter: "history",
          entries: [
            {
              id: "h1",
              kind: "history",
              actorType: "builder",
              summary: "Status changed from planning to development",
              createdAt: "2026-08-04T10:00:00Z"
            }
          ],
          nextBefore: null
        };
      }
      return { filter: "all", entries: [], nextBefore: null };
    });
  });
  it("loads History entries when History filter is clicked", async () => {
    render(<TicketActivitySection projectId="p1" chatId="c1" />);
    await waitFor(() => {
      expect(getActivity).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await waitFor(() => {
      expect(getActivity).toHaveBeenCalledWith({
        projectId: "p1",
        chatId: "c1",
        filter: "history"
      });
      expect(
        screen.getByText("Status changed from planning to development")
      ).toBeTruthy();
    });
  });
});
