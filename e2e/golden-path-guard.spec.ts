import { test, expect, type Page } from "@playwright/test";

/**
 * Token-guard golden-path coverage (no auth, no API spend).
 *
 * Seeds the studio budget to 1k via localStorage, sends a 12-file brief
 * (~14.4k estimated tokens), and asserts the pre-send truncation guard
 * appears with the expected copy and that both dialog buttons route the
 * send onward instead of swallowing it. A 16k budget with the same brief
 * must not raise the guard.
 *
 * "Routes the send" is asserted environment-agnostically: pre-auth on the
 * production site the send reaches the auth gate ("Sign in to continue");
 * on a local dev server without auth the bootstrap succeeds and the send
 * proceeds to a real generation attempt ("Building your project..." /
 * "Generation failed"). Either outcome proves the dialog did not swallow
 * the send.
 *
 * The Continue-repair send is covered at the contract level in
 * src/lib/token-guard.test.ts (builder -> detector -> guard skip ->
 * free-repair qualification); driving it in the browser needs a real
 * truncated generation, which the live golden-path probe handles
 * (docs/golden-path-probe.md).
 */

const SETTINGS_KEY = "Shipboard.studio.settings.v1";

const FILES = Array.from(
  { length: 12 },
  (_, i) => `src/components/Widget${i}.tsx`
).join(", ");
const BIG_BRIEF = `Build a 12-file storefront using ${FILES}. Production React + Tailwind, mobile-first, concrete copy, no lorem.`;

/**
 * The send left the guard dialog and moved onward: auth gate on the
 * production site, or a real generation attempt on an unauth server.
 */
const SEND_ONWARD = /Sign in to continue|Building your project|Generation failed/;

async function seedBudget(page: Page, maxTokens: number) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: SETTINGS_KEY, value: { maxTokens } }
  );
}

test.describe("Token-guard golden path", () => {
  test("guard appears at a 1k budget and both buttons route the send", async ({
    page,
  }) => {
    await seedBudget(page, 1024);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    const composer = page.locator(".composer-textarea");
    await expect(composer).toBeVisible();
    await composer.fill(BIG_BRIEF);
    await page.getByRole("button", { name: "Send", exact: true }).click();

    // Guard dialog with the expected copy.
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("This build will probably truncate")
    ).toBeVisible();
    await expect(dialog.getByText(/12-file build/)).toBeVisible();
    const raiseBtn = dialog.getByRole("button", { name: /Raise to 16k/ });
    const anywayBtn = dialog.getByRole("button", { name: "Send anyway" });
    await expect(raiseBtn).toBeVisible();
    await expect(anywayBtn).toBeVisible();

    // "Send anyway": dialog closes, the send proceeds onward (auth gate on
    // production, generation attempt on an unauth server) — never a silent drop.
    await anywayBtn.click();
    await expect(
      page.getByText("This build will probably truncate")
    ).toBeHidden();
    await expect(page.getByText(SEND_ONWARD).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("'Raise to 16k & send' also routes the send", async ({ page }) => {
    await seedBudget(page, 1024);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    const composer = page.locator(".composer-textarea");
    await expect(composer).toBeVisible();
    await composer.fill(BIG_BRIEF);
    await page.getByRole("button", { name: "Send", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("This build will probably truncate")
    ).toBeVisible();
    await dialog.getByRole("button", { name: /Raise to 16k/ }).click();

    await expect(
      page.getByText("This build will probably truncate")
    ).toBeHidden();
    await expect(page.getByText(SEND_ONWARD).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("no guard at a 16k budget for the same brief", async ({ page }) => {
    await seedBudget(page, 16384);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    const composer = page.locator(".composer-textarea");
    await expect(composer).toBeVisible();
    await composer.fill(BIG_BRIEF);
    await page.getByRole("button", { name: "Send", exact: true }).click();

    // The send proceeds straight onward; the guard never appears.
    await expect(page.getByText(SEND_ONWARD).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("This build will probably truncate")
    ).toHaveCount(0);
  });
});
