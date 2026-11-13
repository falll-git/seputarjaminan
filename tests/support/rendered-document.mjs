import { parseFragment, serialize } from "parse5";

// Inspect SSR output with HTML parsing rules. These helpers are for assertions,
// not for producing sanitized HTML for an application or executing scripts.
function omitScripts(node) {
  if (node.childNodes) {
    node.childNodes = node.childNodes.filter(child => child.tagName !== "script");
    for (const child of node.childNodes) omitScripts(child);
  }
  if (node.content) omitScripts(node.content);
}

export function renderedMarkup(html) {
  const document = parseFragment(html);
  omitScripts(document);
  return serialize(document);
}

export function renderedText(html) {
  const text = [];
  function visit(node) {
    if (node.tagName === "script" || node.tagName === "style") return;
    if (node.nodeName === "#text") text.push(node.value);
    for (const child of node.childNodes || []) visit(child);
    if (node.content) visit(node.content);
  }
  visit(parseFragment(html));
  return text.join(" ");
}
