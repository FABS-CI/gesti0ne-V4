-- Retrait d'un garde-fou appliqué à la base mais absent du dépôt.
--
-- Constat (05/11/2026) : le 03/11, Lovable a appliqué à la base une migration
-- « 0108_compta_garde_exercice_et_saisie_atomique » restée sur la branche
-- lovable-sync, jamais fusionnée. Elle a créé :
--   - le déclencheur trg_garde_exercice_clos (fonction _ecriture_garde_exercice_clos)
--     sur ecritures_comptables et ecriture_lignes : TOUTE insertion, modification ou
--     suppression d'une écriture d'un exercice clôturé est refusée, sans exception ;
--   - la fonction creer_ecriture_manuelle, remplacée depuis par compta_saisir_ecriture
--     (0108_compta_integrite_ecritures) et appelée par aucun écran.
--
-- Effet : l'annulation d'une facture, d'un paiement ou d'un achat d'un exercice
-- clôturé échoue. _delete_ecriture_piece doit marquer l'écriture d'origine comme
-- contre-passée (contrepassee_le, contrepassee_par, piece_ref) : ce marquage est
-- autorisé par trg_ecritures_no_modif_ancienne, mais refusé par trg_garde_exercice_clos.
--
-- Les exercices clôturés restent protégés par les garde-fous du dépôt
-- (0108_compta_integrite_ecritures, 0112_compta_cloture_exercice) :
--   trg_ecritures_zz_exercice_ouvert  nouvelle écriture refusée ;
--   trg_ecritures_no_modif_ancienne   modification refusée, sauf marquage de contre-passation ;
--   trg_ecritures_no_delete           suppression refusée ;
--   trg_ecriture_lignes_verrou        lignes verrouillées.
--
-- Idempotente : sans effet si les objets n'existent pas.

DROP TRIGGER IF EXISTS trg_garde_exercice_clos ON public.ecritures_comptables;
DROP TRIGGER IF EXISTS trg_garde_exercice_clos ON public.ecriture_lignes;
DROP FUNCTION IF EXISTS public._ecriture_garde_exercice_clos();
DROP FUNCTION IF EXISTS public.creer_ecriture_manuelle(date, text, text, text, jsonb);
