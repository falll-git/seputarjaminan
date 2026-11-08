// Real installed dependency regressions; no database, Redis, network, or filesystem mutation.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MediaValidationError, transformPublicImage } from "../apps/worker/src/image-processing.ts";

const require = createRequire(import.meta.url);
const expressRequire = createRequire(require.resolve("express/package.json"));
const postcssRequire = createRequire(require.resolve("postcss/package.json"));
const nextRequire = createRequire(require.resolve("next/package.json"));
const workerRequire = createRequire(new URL("../apps/worker/package.json", import.meta.url));
const proxyaddr = expressRequire("proxy-addr");
const { SourceMapConsumer, SourceMapGenerator } = postcssRequire("source-map-js");
const postcss = require("postcss");
const sharp = workerRequire("sharp");
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("reviewed dependency pins are used by the actual Express, PostCSS, Next, and media worker consumers", () => {
  assert.equal(manifest.overrides["proxy-addr"], "2.0.8");
  assert.equal(manifest.overrides["source-map-js"], "1.2.2");
  assert.equal(manifest.overrides.sharp, "0.35.5");
  assert.equal(expressRequire("proxy-addr/package.json").version, manifest.overrides["proxy-addr"]);
  assert.equal(postcssRequire("source-map-js/package.json").version, manifest.overrides["source-map-js"]);
  assert.equal(sharp.versions.sharp, manifest.overrides.sharp);
  assert.equal(nextRequire("sharp").versions.sharp, manifest.overrides.sharp);
  const workerManifest = JSON.parse(readFileSync(new URL("../apps/worker/package.json", import.meta.url), "utf8"));
  assert.equal(workerManifest.dependencies.sharp, manifest.overrides.sharp);
  // librsvg is not included in every platform build; when present, verify the native patched version too.
  if (sharp.versions.rsvg) {
    const actual = sharp.versions.rsvg.split(".").map(Number);
    assert.ok(actual[0] > 2 || (actual[0] === 2 && (actual[1] > 63 || (actual[1] === 63 && actual[2] >= 2))), "Native librsvg must include the GHSA-wq5f-xc86-pv6w patch");
  }
});

test("Express proxy-addr rejects short mapped IPv6 trust prefixes without breaking valid trust subnets", () => {
  // GHSA-jqcg-44mw-7w3h; upstream regression: jshttp/proxy-addr commit 780911d.
  for (const subnet of ["::ffff:10.0.0.0/8", "::ffff:0.0.0.0/95", "::/1"]) {
    const trust = proxyaddr.compile([subnet]);
    for (const peer of ["8.8.8.8", "::ffff:8.8.8.8"]) assert.equal(trust(peer), false, `${subnet}: ${peer}`);
  }
  const trust = proxyaddr.compile(["::ffff:10.0.0.0/104"]);
  assert.equal(trust("10.0.0.1"), true);
  assert.equal(trust("::ffff:10.0.0.1"), true);
  assert.equal(trust("8.8.8.8"), false);
  const request = { connection: { remoteAddress: "127.0.0.1" }, headers: { "x-forwarded-for": "9.9.9.9" } };
  assert.equal(proxyaddr(request, ["::ffff:10.0.0.0/8"]), "127.0.0.1");
  assert.equal(proxyaddr.compile("uniquelocal")("10.0.0.1"), true);
});

function indexedMap(line, column = 0, map = { version: 3, sources: ["input.js"], sourcesContent: ["let x;"], names: [], mappings: "AAAA" }) {
  return { version: 3, sections: [{ offset: { line, column }, map }] };
}

test("PostCSS source-map-js rejects invalid and excessive indexed offsets, including accumulated nested offsets", () => {
  // GHSA-68fv-2mgg-jv7q; constructor-only cases never serialize huge mappings on an old dependency.
  // Upstream bounds and integer semantics: 7rulnik/source-map-js commit cf76580.
  for (const invalid of [-1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null, undefined, {}]) {
    const invalidLine = indexedMap(0);
    invalidLine.sections[0].offset.line = invalid;
    const invalidColumn = indexedMap(0);
    invalidColumn.sections[0].offset.column = invalid;
    assert.throws(() => new SourceMapConsumer(invalidLine), /offset|line|column/i);
    assert.throws(() => new SourceMapConsumer(invalidColumn), /offset|line|column/i);
  }
  assert.throws(() => new SourceMapConsumer(indexedMap(10_000_001)), /must not exceed/i);
  assert.throws(() => new SourceMapConsumer(indexedMap(5_000_001, 0, indexedMap(5_000_001))), /nested|must not exceed/i);
  const consumer = new SourceMapConsumer(indexedMap(2));
  // Indexed section lookups use the upstream valid-offset specimen's column 1.
  assert.equal(consumer.originalPositionFor({ line: 3, column: 1 }).source, "input.js");
  assert.equal(consumer.originalPositionFor({ line: 3, column: 1 }).line, 1);
});

test("PostCSS retains ordinary source-map generation and decoding after the security update", () => {
  const result = postcss([]).process("a { color: red; }", { from: "input.css", to: "output.css", map: { inline: false, annotation: false } });
  assert.equal(result.css, "a { color: red; }");
  const consumer = new SourceMapConsumer(result.map.toJSON());
  assert.equal(consumer.originalPositionFor({ line: 1, column: 0 }).line, 1);
  const generator = SourceMapGenerator.fromSourceMap(consumer);
  assert.ok(generator.toJSON().mappings.length > 0);
});

test("Sharp preserves supported raster transformations and SVG rejection in the real media worker", async () => {
  for (const format of ["jpeg", "png", "webp"]) {
    const bytes = await sharp({ create: { width: 48, height: 32, channels: 3, background: "#445566" } }).toFormat(format).toBuffer();
    const image = await transformPublicImage(bytes, { mime: `image/${format}`, width: 48, height: 32 });
    assert.equal(image.mime, "image/webp");
    assert.equal(image.width, 48);
    assert.equal(image.height, 32);
    assert.equal((await sharp(image.bytes).metadata()).exif, undefined);
  }
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><rect width="48" height="32" fill="red"/></svg>');
  await assert.rejects(transformPublicImage(svg), MediaValidationError);
});
