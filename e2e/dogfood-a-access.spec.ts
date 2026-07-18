import { test, expect } from "@playwright/test";

/**
 * Dogfood step A (Access) — public surface only.
 * Sign-in OAuth requires real accounts; we assert entry points exist.
 */
test.describe("Dogfood A — Access entry points", () => {
  test("studio exposes sign-in affordance or workspace shell", async ({ page }) => {
    await page.goto("/studio", { waitUntil: "networkidle" }).catch(async () => {
      await page.goto("/studio", { waitUntil: "domcontentloaded" });
    });

    // Either signed-out CTA (GitHub/Google) or already-signed-in chrome
    const signIn = page.getByRole("button", { name: /sign in|log in|github|google/i });
    const signInLink = page.getByRole("link", { name: /sign in|log in|github|google/i });
    const composer = page.getByPlaceholder(/describe|prompt|build|idea/i);
    const anyChat = page.locator("textarea");

    const hasSignIn =
      (await signIn.count()) + (await signInLink.count()) > 0;
    const hasWorkspace =
      (await composer.count()) + (await anyChat.count()) > 0;

    expect(hasSignIn || hasWorkspace).toBeTruthy();

    // Page should not show a Next.js error overlay as main content
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/Application error: a client-side exception/i);
  });

  test("google-site-verification meta present on homepage", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const meta = page.locator('meta[name="google-site-verification"]');
    await expect(meta).toHaveAttribute(
      "content",
      "h9AWOSjaEgCGNAGX2VKoEQwR8uLcZsjrFw3lkwUm0uk"
    );
  });
});
