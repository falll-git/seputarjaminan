import assert from "node:assert/strict";
import test from "node:test";
import { renderedMarkup, renderedText } from "./support/rendered-document.mjs";

test("SSR assertions parse quoted tag boundaries and omit script contents including template descendants", () => {
  const html = '<SCRIPT data-value=">">hidden script text</SCRIPT ><main><h1 id="hero-title">Title</h1><a href="/aset/a?x=1&amp;y=2">Read</a><template><script>hidden nested text</script><p>streamed HTML</p></template></main>';
  const markup = renderedMarkup(html);
  assert.doesNotMatch(markup, /hidden script text|hidden nested text/);
  assert.equal((markup.match(/<h1 id="hero-title"/g) || []).length, 1);
  assert.ok(markup.includes('href="/aset/a?x=1&amp;y=2"'));
  assert.ok(markup.includes("streamed HTML"));
});

test("page text excludes script/style payloads but keeps real contact text and decoded entities", () => {
  const html = '<script>081234567890</script><style>.hash081234567890{}</style><main><p>Contact &amp; information</p><p>081234567891</p></main>';
  const text = renderedText(html);
  assert.doesNotMatch(text, /081234567890/);
  assert.match(text, /Contact & information/);
  assert.match(text, /081234567891/);
});
