import { visit } from "unist-util-visit";

/**
 * Remark plugin that transforms :::tip, :::note, :::warning, :::danger
 * container directives into styled <aside> elements.
 *
 * Requires remark-directive to parse the ::: syntax first.
 */
export function remarkCallouts() {
  const variants = new Set(["tip", "note", "warning", "danger"]);

  return tree => {
    visit(tree, node => {
      if (node.type !== "containerDirective") return;
      if (!variants.has(node.name)) return;

      const variant = node.name;
      const label = node.children[0]?.data?.directiveLabel
        ? (node.children.shift().children[0]?.value ?? variant)
        : variant;

      const data = node.data || (node.data = {});
      data.hName = "aside";
      data.hProperties = {
        class: `callout callout-${variant}`,
        role: "note",
      };

      // Wrap content in a structure: icon + label heading + body
      node.children = [
        {
          type: "paragraph",
          data: { hName: "p", hProperties: { class: "callout-title" } },
          children: [{ type: "text", value: label }],
        },
        {
          type: "element",
          data: { hName: "div", hProperties: { class: "callout-body" } },
          children: node.children,
        },
      ];
    });
  };
}
