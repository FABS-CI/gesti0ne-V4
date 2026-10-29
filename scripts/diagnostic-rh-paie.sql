-- Diagnostic RH / Paie — LECTURE SEULE (transaction READ ONLY annulée).
-- À lancer dans Supabase → SQL Editor. Ne modifie aucune donnée.

BEGIN TRANSACTION READ ONLY;

-- 1. Politiques RLS réellement actives sur les tables RH et paie.
--    « TROP LARGE » : la condition ne demande ni droit RH ni droit paie. Les politiques
--    sont permissives (OR) : une seule politique trop large ouvre toute la table, par
--    exemple salaires, numéros de compte et de CNI de tous les salariés.
SELECT tablename, policyname, cmd, roles::text, qual, with_check,
       CASE WHEN coalesce(qual, '') || coalesce(with_check, '') ~* '(is_staff|^true$|auth\.uid\(\) IS NOT NULL)'
              OR (qual IS NULL AND with_check IS NULL)
            THEN 'TROP LARGE' ELSE '' END AS alerte
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('employes','contrats','conges','absences','bulletins_paie','bulletin_lignes',
                    'employe_documents','evaluations','parametres_paie','paie_regimes','rubriques_paie',
                    'declarations_paie')
ORDER BY alerte DESC, tablename, cmd, policyname;

-- 2. Congés actifs qui se chevauchent pour un même salarié.
SELECT 'conges' AS table_, a.employe_id, a.conge_id AS id_1, b.conge_id AS id_2,
       a.date_debut AS debut_1, a.date_fin AS fin_1, b.date_debut AS debut_2, b.date_fin AS fin_2
FROM conges a JOIN conges b ON a.employe_id = b.employe_id AND a.conge_id < b.conge_id
 AND a.date_debut <= b.date_fin AND a.date_fin >= b.date_debut
WHERE lower(coalesce(a.statut,'')) NOT IN ('annule','annulee','refuse','refusee','rejete','rejetee')
  AND lower(coalesce(b.statut,'')) NOT IN ('annule','annulee','refuse','refusee','rejete','rejetee')
UNION ALL
SELECT 'absences', a.employe_id, a.absence_id, b.absence_id, a.date_debut, a.date_fin, b.date_debut, b.date_fin
FROM absences a JOIN absences b ON a.employe_id = b.employe_id AND a.absence_id < b.absence_id
 AND a.date_debut <= b.date_fin AND a.date_fin >= b.date_debut
WHERE lower(coalesce(a.statut,'')) NOT IN ('annule','annulee','refuse','refusee','rejete','rejetee')
  AND lower(coalesce(b.statut,'')) NOT IN ('annule','annulee','refuse','refusee','rejete','rejetee');

-- 3. Dates incohérentes (fin avant début), conservées par les contraintes NOT VALID.
SELECT 'conges' AS table_, conge_id::text AS id, date_debut, date_fin FROM conges WHERE date_fin < date_debut
UNION ALL SELECT 'absences', absence_id::text, date_debut, date_fin FROM absences WHERE date_fin < date_debut
UNION ALL SELECT 'contrats', contrat_id::text, date_debut, date_fin FROM contrats WHERE date_fin < date_debut;

-- 4. Bulletins établis pour un salarié non actif, ou hors de sa période d'emploi.
SELECT bp.reference, bp.employe_nom, bp.date_debut, bp.date_fin, bp.statut,
       e.statut_employe, e.actif, e.date_embauche, e.date_fin_contrat
FROM bulletins_paie bp JOIN employes e ON e.employe_id = bp.employe_id
WHERE e.statut_employe::text <> 'actif' OR e.actif IS FALSE
   OR e.date_embauche > bp.date_fin OR e.date_fin_contrat < bp.date_debut
ORDER BY bp.date_fin DESC;

-- 5. Fiches contradictoires : statut « actif » mais fiche inactive, ou l'inverse.
SELECT matricule, nom_complet, statut_employe, actif, date_fin_contrat
FROM employes
WHERE deleted_at IS NULL
  AND ((statut_employe::text = 'actif') IS DISTINCT FROM actif
       OR (statut_employe::text = 'actif' AND date_fin_contrat < CURRENT_DATE));

ROLLBACK;
