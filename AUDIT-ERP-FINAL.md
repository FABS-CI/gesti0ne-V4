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

### Points restants identifiés (lots suivants)
- `fournisseurs.creer/modifier` attribués directement au seul rôle super_admin : à confirmer métier.
- `perf_query_log` : insertion par tout connecté conservée (télémétrie sans donnée métier).
- Lectures par tout connecté à revoir : `documents`, `document_templates`, `categories_produits`, `approbation_seuils`.
- Secret de sauvegarde dans le coffre : refusé par la plateforme.
- §4 à §31 (RBAC, routes, workflows, stock, références, certification, FNE, migrations, code mort, tests, CI).

## Vérifications lots A et B
- Typecheck : OK. Vitest : 178 réussis, 12 sautés, 0 échec. Couverture RBAC : 93 OK.
