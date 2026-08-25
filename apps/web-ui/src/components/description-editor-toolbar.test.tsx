import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DescriptionEditorToolbar } from "./description-editor-toolbar";
import type { Editor } from "@tiptap/react";

function fakeEditor(): Editor {
  const chain = {
    focus: () => chain,
    toggleBold: () => chain,
    toggleItalic: () => chain,
    toggleBulletList: () => chain,
    toggleOrderedList: () => chain,
    toggleTaskList: () => chain,
    toggleCodeBlock: () => chain,
    toggleBlockquote: () => chain,
    setHorizontalRule: () => chain,
    insertTable: () => chain,
    setImage: () => chain,
    insertContent: () => chain,
    run: () => true
  };
  return { chain: () => chain } as unknown as Editor;
}

describe("DescriptionEditorToolbar", () => {
  it("renders save button", () => {
    render(<DescriptionEditorToolbar editor={fakeEditor()} onSave={vi.fn()} />);
    expect(screen.getByText("Save")).toBeTruthy();
  });
});
