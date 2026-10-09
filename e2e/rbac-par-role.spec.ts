import { expect, test, type Page } from "@playwright/test";

/**
 * Lot 8b — Tests E2E RBAC par rôle.
 *
 * Pour chaque rôle métier, on se connecte avec un utilisateur dédié
 * (créé en base, associé au rôle correspondant via `rbac_user_roles`)
 * et on vérifie que :
 *   - les routes "allowed" s'affichent normalement,
 *   - les routes "denied" redirigent vers /acces-refuse.
 *
 * Convention des variables d'environnement (skip si absentes) :
 *   E2E_ROLE_<ROLE>_EMAIL      ex: E2E_ROLE_COMPTABLE_EMAIL
 *   E2E_ROLE_<ROLE>_PASSWORD
 *
 * Rôles couverts : super_admin, directeur_general, comptable,
 * directeur_commercial, gestionnaire_stock, responsable_magasinier,
 * secretariat, service_logistique.
 */

type RoleMatrix = {
  role: string;
  allowed: string[];
  denied: string[];
};

const MATRIX: RoleMatrix[] = [
  {
    role: "super_admin",
    allowed: ["/dashboard", "/roles-permissions", "/audit", "/utilisateurs", "/parametres"],
    denied: [],
  },
  {
    role: "directeur_general",
    allowed: ["/rapports", "/clients", "/commandes"],
    denied: ["/roles-permissions", "/paie-parametres"],
  },
  {
    role: "comptable",
    allowed: ["/comptabilite", "/ecritures-comptables", "/balance", "/grand-livre", "/factures"],
    denied: ["/roles-permissions", "/employes"],
  },
  {
    role: "directeur_commercial",
    allowed: ["/clients", "/commandes", "/proformas", "/factures", "/etat-compte-clients"],
    denied: ["/comptabilite", "/roles-permissions"],
  },
  {
    role: "gestionnaire_stock",
    allowed: ["/produits", "/stock", "/depots", "/inventaires", "/incidents", "/transferts"],
    denied: ["/comptabilite", "/paie", "/roles-permissions"],
  },
  {
    role: "responsable_magasinier",
    allowed: ["/stock", "/inventaires", "/incidents"],
    denied: ["/comptabilite", "/roles-permissions", "/paie"],
  },
  {
    role: "secretariat",
    allowed: ["/clients", "/commandes", "/notifications", "/profil"],
    denied: ["/comptabilite", "/roles-permissions", "/paie", "/audit"],
  },
  {
    role: "service_logistique",
    allowed: ["/tournees", "/livraison-suivi", "/colisage", "/incidents"],
    denied: ["/comptabilite", "/paie", "/roles-permissions"],
  },
];

function credsFor(role: string): { email?: string; password?: string } {
  const key = role.toUpperCase();
  return {
    email: process.env[`E2E_ROLE_${key}_EMAIL`],
    password: process.env[`E2E_ROLE_${key}_PASSWORD`],
  };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mot de passe|password/i).first().fill(password);
  await page.getByRole("button", { name: /connexion|se connecter|sign in/i }).click();
  await expect(page).not.toHaveURL(/\/auth(\?|$)/, { timeout: 15_000 });
}

async function signOut(page: Page) {
  await page.evaluate(() => {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("sb-") && k.endsWith("-auth-token")) window.localStorage.removeItem(k);
    }
  });
}

for (const entry of MATRIX) {
  const { email, password } = credsFor(entry.role);
  const hasCreds = !!(email && password);

  test.describe(`RBAC — rôle ${entry.role}`, () => {
    test.skip(!hasCreds, `E2E_ROLE_${entry.role.toUpperCase()}_EMAIL/PASSWORD non fournis`);

    test.beforeEach(async ({ page }) => {
      await signIn(page, email!, password!);
    });

    test.afterEach(async ({ page }) => {
      await signOut(page);
    });

    for (const path of entry.allowed) {
      test(`accès autorisé : ${path}`, async ({ page }) => {
        await page.goto(path);
        // Le RouteGuard ne doit pas rediriger vers /acces-refuse.
        await expect(page).not.toHaveURL(/\/acces-refuse/, { timeout: 10_000 });
        // Et l'URL finale doit correspondre (ou rester dans le sous-arbre).
        await expect(page).toHaveURL(new RegExp(`^.*${path}(/|$|\\?)`));
      });
    }

    for (const path of entry.denied) {
      test(`accès refusé : ${path}`, async ({ page }) => {
        await page.goto(path);
        // Attendu : redirection vers /acces-refuse par RouteGuard.
        await expect(page).toHaveURL(/\/acces-refuse/, { timeout: 10_000 });
      });
    }
  });
}