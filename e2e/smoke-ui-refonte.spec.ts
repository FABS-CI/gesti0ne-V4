import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

// Sprint 9 — parcours de fumée : connexion → tableau de bord → factures → fiche → retour,
// en clair puis en sombre, sans erreur console.
for (const theme of ["light", "dark"] as const) {
  test(`parcours principal sans erreur console (${theme})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ colorScheme: theme });
    await signInAsTestUser(page);
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
    await page.goto("/factures");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    const first = page.locator('a[href^="/factures/"]').first();
    if (await first.count()) {
      await first.click();
      await expect(page).toHaveURL(/\/factures\/.+/);
      await page.goBack();
      await expect(page).toHaveURL(/\/factures/);
    }
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(scroll, "défilement horizontal").toBe(false);
    expect(errors).toEqual([]);
  });
}
