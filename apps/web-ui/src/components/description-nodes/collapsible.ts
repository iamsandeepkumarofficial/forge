import { Node, mergeAttributes } from "@tiptap/react";
export const Collapsible = Node.create({
  name: "collapsible",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      summary: {
        default: "Details",
        parseHTML: (el) => el.getAttribute("data-summary") || "Details",
        renderHTML: (attrs) => ({ "data-summary": attrs.summary })
      },
      collapsed: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-collapsed") !== "false",
        renderHTML: (attrs) => ({
          "data-collapsed": attrs.collapsed ? "true" : "false"
        })
      }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="collapsible"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const summary = (node.attrs.summary as string) || "Details";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "collapsible",
        class: "rounded-md border border-border my-2"
      }),
      ["div", { class: "px-3 py-2 text-sm font-medium bg-muted/30" }, summary],
      ["div", { class: "px-3 py-2" }, 0]
    ];
  }
});
