import { expect, test, type Page } from "@playwright/test";

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test("beranda memuat data nyata fixture dan carousel hanya bergerak melalui kontrol", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Temukan aset. Kenali penerbitnya." })).toBeVisible();
  await expect(page.getByLabel("Slide 1 dari 5")).toBeVisible();
  await page.getByRole("button", { name: "Aset berikutnya" }).click();
  await expect(page.getByLabel("Slide 2 dari 5")).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByLabel("Slide 2 dari 5")).toBeVisible();
  expect(errors).toEqual([]);
});

test("katalog membuka quick view, mengunci scroll, dan mengembalikan fokus", async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto("/katalog");
  const opener = page.getByRole("button", { name: "Lihat ringkas" }).first();
  await expect(opener).toBeVisible();
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rumah tinggal dekat pusat kota" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  await expect.poll(() => page.evaluate(() => document.body.getAttribute("data-scroll-locked"))).toBe("1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
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
  await expect(page.getByText("Tidak ada aset contoh yang digunakan sebagai pengganti.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lihat ringkas" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
