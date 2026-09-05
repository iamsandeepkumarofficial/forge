import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ParameterStorePanel } from "./workspace-settings-parameters";

const onAdd = vi.fn();
const onSaveExisting = vi.fn();
const onDelete = vi.fn();
const setDraftKey = vi.fn();
const setDraftValue = vi.fn();
const setDraftSecret = vi.fn();

const storeState = {
  rows: [] as Array<{
    key: string;
    value: string;
    secret: boolean;
    hasValue?: boolean;
  }>,
  error: null as string | null,
  busy: false,
  draftKey: "",
  draftValue: "",
  draftSecret: false,
  setDraftKey,
  setDraftValue,
  setDraftSecret,
  onSaveExisting,
  onAdd,
  onDelete
};

vi.mock("./use-parameter-store.js", () => ({
  useParameterStore: () => storeState
}));

describe("ParameterStorePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.rows = [];
    storeState.error = null;
    storeState.busy = false;
    storeState.draftKey = "";
    storeState.draftValue = "";
    storeState.draftSecret = false;
  });

  it("shows empty state and Add disabled without a key", () => {
    render(<ParameterStorePanel workspaceId="w1" />);
    expect(screen.getByText("Parameter store")).toBeTruthy();
    expect(screen.getByText(/No parameters yet/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("lists rows and saves an existing value", () => {
    storeState.rows = [
      { key: "JWT_SECRET", value: "", secret: true, hasValue: false }
    ];
    render(<ParameterStorePanel workspaceId="w1" />);
    expect(screen.getByText("JWT_SECRET")).toBeTruthy();
    expect(screen.getByText(/secret/)).toBeTruthy();
    const input = screen.getByPlaceholderText("••••••••");
    fireEvent.change(input, { target: { value: "super-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveExisting).toHaveBeenCalledWith(
      storeState.rows[0],
      "super-secret"
    );
  });

  it("drafts a new key and calls onAdd", () => {
    storeState.draftKey = "API_URL";
    storeState.draftValue = "https://x";
    render(<ParameterStorePanel workspaceId="w1" />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByPlaceholderText("JWT_SECRET"), {
      target: { value: "OTHER" }
    });
    expect(setDraftKey).toHaveBeenCalledWith("OTHER");
  });
});
