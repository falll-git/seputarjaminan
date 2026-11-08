import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import postcss from "postcss";
import { normalizeTheme, THEME_BOOTSTRAP } from "../app/lib/theme.ts";

const root = new URL("../", import.meta.url);
const tokens = await readFile(new URL("app/design-tokens.css", root), "utf8");
const declarations = new Map();
postcss.parse(tokens).walkRules(rule => {
  if (rule.selector === ":root, [data-preview-theme]" && rule.parent.type === "root") rule.walkDecls(d => declarations.set(d.prop, d.value));
});
function value(name, mode) {
  const raw = declarations.get(`--${name}`);
  assert.ok(raw, `Missing token ${name}`);
  const alias = raw.match(/^var\(--([\w-]+)\)$/);
  if (alias) return value(alias[1], mode);
  const pair = raw.match(/^light-dark\((#[\da-f]+),\s*(#[\da-f]+)\)$/i);
  return pair ? pair[mode === "light" ? 1 : 2] : raw;
}
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function ratio(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function contrast(a, b, mode, min = 4.5) {
  const actual = ratio(value(a, mode), value(b, mode));
  assert.ok(actual >= min, `${mode} ${a}/${b}: ${actual.toFixed(2)} < ${min}`);
}

for (const mode of ["light", "dark"]) {
  test(`${mode}: text, controls and all interaction-state contrast pairs`, () => {
    for (const surface of ["color-background", "color-surface", "color-surface-elevated"]) {
      for (const foreground of ["color-text", "color-text-supporting", "color-placeholder", "color-link", "color-link-hover", "color-link-active"]) contrast(foreground, surface, mode);
      for (const control of ["color-control-border", "color-focus", "color-action", "color-action-hover", "color-action-active"]) contrast(control, surface, mode, 3);
    }
    for (const action of ["color-action", "color-action-hover", "color-action-active"]) contrast("color-on-action", action, mode);
    contrast("color-disabled-text", "color-disabled-surface", mode);
    contrast("color-disabled-border", "color-disabled-surface", mode, 3);
    for (const state of ["available", "error", "warning", "info"]) contrast(`color-status-${state}-text`, `color-status-${state}-surface`, mode);
    contrast("color-status-available-border", "color-status-available-surface", mode, 3);
    contrast("color-logo-text", "color-logo-surface", mode);
    contrast("color-on-media", "color-media-control", mode);
    contrast("color-inverse-supporting", "color-inverse-surface", mode);
    contrast("color-inverse-accent", "color-inverse-surface", mode);
  });
}

test("bootstrap resolves storage before rendering, safely defaults to system", () => {
  for (const osDark of [true, false]) {
    for (const stored of [null, "system", "light", "dark", "invalid", "<script>"]) {
      const document = { documentElement: { dataset: {} } };
      vm.runInNewContext(THEME_BOOTSTRAP, { document, localStorage: { getItem: () => stored }, matchMedia: () => ({ matches: osDark }) });
      const preference = normalizeTheme(stored);
      assert.equal(document.documentElement.dataset.themePreference, preference);
      assert.equal(document.documentElement.dataset.theme, preference === "system" ? osDark ? "dark" : "light" : preference);
    }
    const document = { documentElement: { dataset: {} } };
    vm.runInNewContext(THEME_BOOTSTRAP, { document, localStorage: { getItem() { throw new Error("blocked"); } }, matchMedia: () => ({ matches: osDark }) });
    assert.equal(document.documentElement.dataset.theme, osDark ? "dark" : "light");
  }
});

test("color declarations centralized; no accidental image color filtering", async () => {
  const files = (await readdir(new URL("app/", root))).filter(f => f.endsWith(".css") && f !== "design-tokens.css");
  files.push("components/BprsMarquee.module.css", "components/ThemeControl.module.css", "components/AssetCard.module.css", "components/HeroAssetCarousel.module.css", "components/SiteFooter.module.css", "katalog/catalog.module.css", "dev/design-system/preview.module.css");
  files.push("components/AssetContact.module.css", "aset/[slug]/detail.module.css");
  files.push("components/BrandLockup.module.css");
  files.push("bprs/bprs.module.css", "cara-minat/help.module.css", "components/PublicLoadingState.module.css");
  for (const file of files) {
    const source = await readFile(new URL(`app/${file}`, root), "utf8");
    postcss.parse(source).walkDecls(d => {
      assert.doesNotMatch(d.value, /#[\da-f]{3,8}\b|rgba?\([^)]*\)|(?<![-\w])(?:white|black)(?![-\w])/i, `Literal color in ${file}: ${d.prop}`);
      if (d.prop === "filter" || d.prop === "backdrop-filter") assert.doesNotMatch(d.value, /invert|grayscale|brightness|saturate/i);
    });
  }
});

test("font files resolve locally and CSS/JS motion contracts remain aligned", async () => {
  const fontConfig = await readFile(new URL("app/fonts.ts", root), "utf8");
  const files = [...fontConfig.matchAll(/src: "([^"]+)"/g)].map(m => m[1]);
  assert.equal(files.length, 2);
  for (const file of files) {
    const bytes = await readFile(new URL(file, new URL("app/", root)));
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.ok(bytes.length < 40_000);
  }
  assert.doesNotMatch(fontConfig, /next\/font\/google|https?:\/\//);
  assert.equal((fontConfig.match(/display: "swap"/g) ?? []).length, 2);
  const motion = await readFile(new URL("app/lib/public-motion.ts", root), "utf8");
  for (const [name, milliseconds] of [["fast", 180], ["standard", 240], ["slow", 400]]) {
    assert.equal(declarations.get(`--motion-${name}`), `${milliseconds}ms`);
    assert.match(motion, new RegExp(`${name}:\\s*${milliseconds / 1000}`));
  }
});

test("preview is development-only and excluded from public navigation", async () => {
  const source = await readFile(new URL("app/dev/design-system/page.tsx", root), "utf8");
  assert.match(source, /if \(process\.env\.NODE_ENV !== "development"\) notFound\(\)/);
  assert.match(source, /index: false, follow: false/);
  for (const file of ["app/page.tsx", "app/components/SiteHeader.tsx", "app/components/SiteFooter.tsx"]) {
    assert.doesNotMatch(await readFile(new URL(file, root), "utf8"), /\/dev\/design-system/);
  }
});

test("visual audit regressions: route skeletons, uncropped gallery, honest media and overlay clearance", async () => {
  const read = file => readFile(new URL(`app/${file}`, root), "utf8");
  const [loading, profile, gallery, media, contact, notice, foundation, states, publicState] = await Promise.all([
    read("components/PublicLoadingState.tsx"), read("bprs/[slug]/loading.tsx"), read("components/AssetDetailGallery.tsx"), read("components/PublicMedia.tsx"), read("components/AssetContact.tsx"), read("components/ConnectivityNotice.tsx"), read("foundation.css"), read("system-states.css"), read("components/PublicDataState.tsx"),
  ]);
  assert.match(loading, /data-loading-variant=\{variant\}/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(profile, /variant="profile"/);
  assert.match(gallery, /fit="contain"/);
  assert.match(gallery, /key\.key !== "Tab"/);
  assert.match(gallery, /key\.shiftKey/);
  assert.match(gallery, /setAttribute\("aria-modal", "true"\)/);
  assert.match(media, /Foto aset belum tersedia/);
  assert.match(media, /Foto aset belum dapat dimuat/);
  assert.match(contact, /--contact-dock-height/);
  assert.match(notice, /--connectivity-notice-height/);
  assert.match(notice, /observer\.disconnect/);
  assert.match(foundation, /scroll-padding-bottom: calc\(var\(--contact-dock-height, 0px\) \+ var\(--connectivity-notice-height, 0px\)/);
  assert.match(states, /bottom: calc\(var\(--contact-dock-height, 0px\)/);
  assert.match(publicState, /headingLevel === 1/);
  const routes = await read("routes.css");
  assert.match(routes, /\.pswp__button--arrow--next \.pswp__icn \{ transform: none;/);
  assert.match(routes, /\.sj-photoswipe-context \{[^}]*background: var\(--color-media-control\)/);
  for (const path of ["aset/[slug]/page.tsx", "bprs/[slug]/page.tsx"]) assert.match(await read(path), /headingLevel=\{1\}/);
});
