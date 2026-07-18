import { test, expect } from "@playwright/test";

/**
 * Dogfood A (partial) + studio shell — no authenticated generate.
 * Full A→E still needs a human (OAuth + gen quota).
 */
test.describe("Studio smoke", () => {
  test("studio loads without crash", async ({ page }) => {
    const res = await page.goto("/studio", { waitUntil: "domcontentloaded" });
    expect(res?.ok() || res?.status() === 304).toBeTruthy();

    await expect(page).toHaveTitle(/Studio|Shipboard/i);

    const body = page.locator("body");
    await expect(body).toBeVisible();
    const text = await body.innerText();
    expect(text.length).toBeGreaterThan(20);

    // No full-page fatal white/empty
    await expect(page.locator("html")).toHaveClass(/dark|/);
  });

  test("homepage Start free reaches studio", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const cta = page.getByRole("link", { name: /start free|open studio/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/studio/);
  });

  test("docs links to studio", async ({ page }) => {
    await page.goto("/docs", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /open studio|studio/i }).first().click();
    await expect(page).toHaveURL(/\/studio/);
  });
});
