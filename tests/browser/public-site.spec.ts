import { expect, test, type Page } from "@playwright/test";

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test("beranda: search di header, carousel manual menjeda rotasi", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Jelajahi aset dari BPRS" })).toBeVisible();
  // Scope to the accessible carousel, excluding transient hidden streamed markup.
  const carousel = page.getByRole("region", { name: "Jelajahi aset", exact: true });
  await expect(carousel).toHaveCount(1);
  await expect(page.getByRole("banner").getByRole("search")).toBeVisible();
  await expect(carousel.getByRole("button", { name: "Tampilkan aset 1", exact: true })).toHaveAttribute("aria-current", "true");
  await carousel.getByRole("button", { name: "Aset berikutnya" }).click();
  await expect(carousel.getByRole("button", { name: "Tampilkan aset 2", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(carousel.getByRole("button", { name: "Putar carousel" })).toBeVisible();
  await page.mouse.move(0, 0); await page.waitForTimeout(6500);
  await expect(carousel.getByRole("button", { name: "Tampilkan aset 2", exact: true })).toHaveAttribute("aria-current", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(carousel.getByRole("button", { name: /(?:Jeda|Putar) carousel/ })).toHaveCount(0);
  await carousel.getByRole("button", { name: "Aset berikutnya" }).click();
  await expect(carousel.getByRole("button", { name: "Tampilkan aset 2", exact: true })).toHaveAttribute("aria-current", "true");
  await page.mouse.move(0, 0); await page.waitForTimeout(6500);
  await expect(carousel.getByRole("button", { name: "Tampilkan aset 2", exact: true })).toHaveAttribute("aria-current", "true");
  expect(errors).toEqual([]);
});

test("katalog memakai satu jalur detail aset tanpa quick view kedua", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto("/katalog");
  await expect(page.getByRole("button", { name: "Lihat ringkas" })).toHaveCount(0);
  const detail = page.getByRole("link", { name: /^Lihat detail/ }).first();
  await expect(detail).toHaveAttribute("href", "/aset/sj-test0001?returnTo=%2Fkatalog");
  await detail.click();
  await expect(page.getByRole("heading", { name: "Rumah tinggal dekat pusat kota" })).toBeVisible();
  // A heading can be present yet stranded above the viewport after smooth route scrolling.
  await expect(page.getByRole("heading", { name: "Rumah tinggal dekat pusat kota" })).toBeInViewport({ ratio: 1 });
  expect(errors).toEqual([]);
});

test("filter mobile dapat ditutup dengan Escape dan fokus kembali ke pemicu", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/katalog");
  const trigger = page.getByRole("button", { name: /^Filter/u });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Filter katalog" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Filter katalog" })).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("detail aset membuka dan menutup lightbox PhotoSwipe", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto("/aset/sj-test0001");
  await expect(page.getByRole("heading", { name: "Rumah tinggal dekat pusat kota" })).toBeVisible();
  await page.getByRole("link", { name: /Buka foto 1 dari 3 pada layar penuh/u }).click();
  const close = page.getByRole("button", { name: "Tutup galeri" });
  await expect(close).toBeVisible();
  await expect(page.locator(".pswp")).toHaveCSS("opacity", "1");
  await close.click();
  await expect(close).toBeHidden();
  expect(errors).toEqual([]);
});

test("kegagalan API menjadi state Indonesia tanpa data katalog palsu", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto("/katalog?q=__api-failure__");
  await expect(page.getByRole("heading", { name: "Katalog belum dapat dimuat." })).toBeVisible();
  await expect(page.getByText("Jumlah aset belum tersedia.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-asset-card]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lihat ringkas" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
