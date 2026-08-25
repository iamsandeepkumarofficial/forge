import { Node, mergeAttributes } from "@tiptap/react";
export const Decision = Node.create({
  name: "decision",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      status: {
        default: "open",
        parseHTML: (el) => el.getAttribute("data-status") || "open",
        renderHTML: (attrs) => ({ "data-status": attrs.status })
      }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="decision"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "decision",
        class: "rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-3 my-2"
      }),
      0
    ];
  }
});
