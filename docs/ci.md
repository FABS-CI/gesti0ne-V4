# CI : contrôles obligatoires et réglages GitHub

Le workflow `.github/workflows/ci.yml` lance quatre contrôles. `deploy-guard` les
vérifie sur `main` et échoue si l'un d'eux n'a pas réussi **ou n'a pas été exécuté**.

| Contrôle | Pull request | main |
|---|---|---|
| typecheck | obligatoire | obligatoire |
| unit (vitest) | obligatoire | obligatoire |
| rls (psql) | ignoré avec avertissement si le secret manque | **échec** si le secret manque |
| e2e (Playwright desktop + mobile) | ignoré avec avertissement si un prérequis manque | **échec** si un prérequis manque |

`deploy-guard` est une barrière de validation, pas un déploiement : Lovable publie
l'application indépendamment de GitHub. Un `main` rouge signale qu'une publication
n'est pas couverte par les contrôles ; il ne l'empêche pas à lui seul.

## Prérequis à configurer (intervention humaine)

Settings → Secrets and variables → Actions :

| Nom | Type | Contenu |
|---|---|---|
| `SUPABASE_DB_URL` | secret | URL postgres d'une base de **test**. Rôle de lecture suffisant : le script tourne en transaction `READ ONLY` annulée. |
| `E2E_BASE_URL` | secret | URL d'une application de **test** reliée à une base de test. |
| `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` | secrets | Compte `super_admin` de l'environnement de test. |
| `E2E_CLIENT_URL` | secret | Optionnel (spec `client-ville-commune`). |
| `E2E_TARGET_IS_TEST` | **variable** | `true` uniquement après avoir vérifié que `E2E_BASE_URL` n'utilise pas la base de production. |

Les tests e2e **créent et suppriment des données**. Ne jamais pointer `E2E_BASE_URL`
vers l'application publiée : elle utilise la base de production. Attention aussi en
local : sans `E2E_BASE_URL`, Playwright lance `bun run dev`, qui lit le `.env` du dépôt
(projet Supabase de production).

## Protection de la branche main

Settings → Branches → règle sur `main` :

1. *Require a pull request before merging*.
2. *Require status checks to pass* : cocher `Deploy guard (bloque la publication en cas d'échec)`,
   `TypeScript typecheck (tsgo)` et `Unit + a11y (vitest + jest-axe)`.
3. *Do not allow bypassing the above settings* (sinon un administrateur peut fusionner sans CI).

Limite connue : Lovable pousse directement sur `main`. Si la protection l'en empêche,
la synchronisation Lovable casse ; il faut alors choisir entre la protection et l'édition
directe dans Lovable.
