import { Node, mergeAttributes } from "@tiptap/react";
export const InfoPanel = Node.create({
  name: "infoPanel",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (el) => el.getAttribute("data-variant") || "info",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant })
      }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="info-panel"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "info-panel",
        class: "rounded-md border border-border bg-muted/40 p-3 my-2"
      }),
      0
    ];
  }
});
