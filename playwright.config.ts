import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright pour les tests E2E.
 *
 * Prérequis :
 *   - Un utilisateur de test avec le rôle `super_admin` doit exister dans
 *     l'environnement ciblé. Fournissez ses identifiants via les variables :
 *       E2E_TEST_EMAIL     — email de l'utilisateur de test
 *       E2E_TEST_PASSWORD  — mot de passe associé
 *   - Le serveur de dev est lancé automatiquement par Playwright (bun dev).
 *
 * Exécution :  bun run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Un test.only oublié ferait passer la CI en n'exécutant qu'un seul test.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["json", { outputFile: "playwright-report/results.json" }],
        ["github"],
      ]
    : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    // Pas de trace en CI : une trace enregistre les valeurs saisies (mot de passe du
    // compte de test compris) et serait publiée dans les artefacts. Screenshot et
    // vidéo sur échec suffisent au diagnostic ; en local la trace reste disponible.
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: { mode: "only-on-failure", fullPage: true },
    video: process.env.CI ? "retain-on-failure" : "off",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    viewport: { width: 1280, height: 900 },
  },
  // Noms attendus par la CI (--project=desktop|mobile) et par les specs
  // (testInfo.project.name === "mobile") : avec un seul projet « chromium »,
  // la CI échouait (« Project(s) "desktop" not found ») et les tests mobiles
  // étaient toujours ignorés. Pixel 7 = Chromium, seul navigateur installé en CI.
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});