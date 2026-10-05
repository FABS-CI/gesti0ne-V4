# Audit ERP Gesti-ONE (fichier-56) — rapport en cours

Traitement par lots, dans l'ordre de priorité du cahier : sécurité → intégrité → cohérence métier → workflows → performance → code mort.

## Lot A — Sécurité PostgreSQL (§1 à §3) — migration `0049_securite_audit_lot_a.sql`

| PROBLÈME | CAUSE | CORRECTION | TEST | STATUT |
|---|---|---|---|---|
| 49 fonctions SECURITY DEFINER exécutables sans connexion (dont `valider_commande`, `enregistrer_paiement_multi`, `merge_clients`, `retour_creer_et_valider`, `ajuster_stock_depot_v3`, `recalculer_soldes_global_clients`) | droit EXECUTE par défaut à PUBLIC | EXECUTE retiré à PUBLIC/anon; conservé pour authenticated + service_role; fonctions trigger retirées aussi à authenticated. Seule exception : `get_carton_public` (page publique QR carton) | appel anon `valider_commande` → 401; `get_carton_public` → 200 | Corrigé |
| `approbation_deleguer` sans contrôle de permission | aucune vérification RBAC | `assert_permission('approbations.valider')` | vérification de la définition en base | Corrigé |
| `approbation_escalader_sla` sans contrôle | idem | appel utilisateur : `approbations.voir`; appel système (sans utilisateur) inchangé | idem | Corrigé |
| `retour_creer_demande` sans contrôle | idem | `assert_permission('retours.creer')` | idem | Corrigé |
| `fournisseurs` : policy ALL `auth.uid() IS NOT NULL` | tout connecté pouvait lire/créer/modifier/supprimer (OR avec la policy de lecture) | supprimée; INSERT/UPDATE/DELETE par `fournisseurs.creer/modifier/supprimer` | policies vérifiées en base | Corrigé |
| `rbac3_audit` : INSERT `WITH CHECK (true)` | journal falsifiable par tout connecté | policy supprimée (écritures par fonctions serveur) | aucune insertion directe dans le code | Corrigé |

Déjà conformes : `valider_commande`, `convertir_commande_en_bl`, `creer_colisage_manuel` (assert_permission présent). `generer_facture` et `utiliser_points_fidelite` n'existent pas en base.

## Lot B — Accès trop larges restants — migration `0050_securite_audit_lot_b.sql`

| PROBLÈME | CORRECTION | TEST | STATUT |
|---|---|---|---|
| `backups_security_backup` sans RLS, lisible sans connexion | droits retirés à anon/authenticated, RLS activée | lecture anon → 42501 refusée | Corrigé |
| Insertion directe ouverte dans `audit_stock`, `couts_logistiques_audit`, `historique_envois`, `livsuivi_historique` | policies supprimées (écritures uniquement par fonctions SECURITY DEFINER `cloturer_tournee`, `livsuivi_avancer`, `livsuivi_confirmer_reception`; aucune insertion dans le code) | policies vérifiées en base | Corrigé |
| `fne_logs` insérable par tout connecté | réservé à `fne.soumettre` / `fne.reessayer` / `fne.rembourser` | policy vérifiée | Corrigé |
| `client_code_counters` lisible par tous | policy supprimée (lu par le trigger serveur) | aucune lecture dans le code | Corrigé |
| `document_certifications` lisible par tout connecté (jetons inclus) | policy supprimée; `listCertificationsFn` lit côté serveur, colonnes sans jeton | page publique `/verify/…` testée sur REL-CL-LIB-24 : OK | Corrigé |

## Lot C — RBAC (§4) et droits des pages (§5) — migration `0051_securite_audit_lot_c_rbac3_alignement.sql`

| PROBLÈME | CORRECTION | TEST | STATUT |
|---|---|---|---|
| Policies fournisseurs/fne_logs des lots A/B basées sur RBAC2 (`has_permission_v2`) alors que l'interface et les autres tables utilisent RBAC3 : comptable, assistante comptable, secrétariat, gestionnaire stock bloqués | policies réécrites avec `rbac3_can` (lecture `fournisseurs.lire`/`achats.lire`, écriture `fournisseurs.creer/modifier/supprimer`; `fne_logs` = `factures.modifier` comme `fne_factures`) | policies vérifiées en base | Corrigé |
| Pages de création/modification héritant d'un simple droit de lecture : absences, congés, contrats, employés, évaluations, fournisseurs, comptabilité/nouvelle, paie/nouveau, FNE nouvelle, paramètres/zones-livraison, utilisateurs (nouveau, modifier, production) | `ROUTE_TO_PERMISSION` : droits `.creer` / `.modifier` | `route-permissions.test.ts` (19 cas) | Corrigé |
| Clé `/stock_/$produitId/mouvements` (nom de fichier) au lieu de l'URL réelle `/stock/$produitId/mouvements` | clé corrigée, `/stock_` retiré | test dédié | Corrigé |
| `/admin/roles-v3`, `/admin/sante-systeme`, `/admin/web-vitals` non déclarées | déclarées (`roles_permissions.voir`, `audit.voir`) | audit automatique des routes | Corrigé |
| Aucune garantie qu'un droit de page soit attribuable via RBAC3 | test : chaque droit de page doit être accordable par une permission RBAC3 | test ajouté | Corrigé |

Impact vérifié en base (RBAC3) : seul le rôle directeur_general (lecture fournisseurs) perd l'accès à « Nouveau fournisseur ».

Constats RBAC (§4), non modifiés :
- Écran actif : `/admin/roles-v3` (menu, RBAC3). `/roles-permissions` (lien depuis le tableau de sécurité) édite encore RBAC2.
- Les RPC métier (`assert_permission`, `has_permission`, `has_permission_v2`) vérifient encore RBAC2, alors que l'interface et les RLS utilisent RBAC3. Exemples d'écarts : `retours.creer` (RBAC2 : commercial, directeur commercial, logistique; RBAC3 : + comptable, gestionnaire stock, responsable magasin, admin). Retirer RBAC2 et `/roles-permissions` exige d'abord de basculer ces contrôles RPC sur RBAC3.
- Pages de fait réservées au Super Administrateur (aucun droit RBAC3 ne les ouvre) : `/stock/audit`, `/fne-settings`, `/workflows-definitions` — laissées en l'état (pas d'élargissement sans décision).

### Points restants identifiés (lots suivants)
- `perf_query_log` : insertion par tout connecté conservée (télémétrie sans donnée métier).
- Lectures par tout connecté à revoir : `documents`, `document_templates`, `categories_produits`, `approbation_seuils`.
- Secret de sauvegarde dans le coffre : refusé par la plateforme.
- §4 à §31 (RBAC, routes, workflows, stock, références, certification, FNE, migrations, code mort, tests, CI).

## Vérifications lots A, B et C
- Typecheck : OK. Vitest : 182 réussis, 12 sautés, 0 échec. Couverture RBAC : 110 OK.
