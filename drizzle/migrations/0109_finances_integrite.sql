-- Intégrité des finances (audit du module Finances).
--
-- Constats :
--   1. Deux déclencheurs comptabilisent les paiements (trg_paiement_ecriture, juin,
--      sans référence de pièce ; trg_paiements_ecriture, juillet, idempotent par
--      PAI:<id>) et deux les factures (trg_facture_ecriture / trg_factures_ecriture).
--      Si l'ancien est encore présent, chaque paiement ou facture est comptabilisé
--      deux fois (trésorerie, clients et ventes doublés). La base réelle ne suit pas
--      un rejeu linéaire des migrations : l'ancien est retiré s'il existe et le
--      nouveau est garanti.
--   2. Transactions (recettes / dépenses) : supprimées physiquement et modifiables
--      après validation, sans trace ; montant non contrôlé côté serveur.

-- ─── 1. Une seule comptabilisation par paiement et par facture ──────────────
DROP TRIGGER IF EXISTS trg_paiement_ecriture ON public.paiements;
DROP TRIGGER IF EXISTS trg_facture_ecriture ON public.factures;
-- Versions « déclencheur » sans argument, utilisées seulement par ces déclencheurs
-- (les versions (uuid) des générateurs restent).
DROP FUNCTION IF EXISTS public.generate_ecriture_paiement();
DROP FUNCTION IF EXISTS public.generate_ecriture_facture();

CREATE OR REPLACE FUNCTION public._trg_facture_ecriture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._delete_ecriture_piece('FACT:' || OLD.facture_id::text);
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.statut <> 'annulee' THEN PERFORM public.generate_ecriture_facture(NEW.facture_id); END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.statut = 'annulee' AND coalesce(OLD.statut,'') <> 'annulee' THEN
      PERFORM public._delete_ecriture_piece('FACT:' || NEW.facture_id::text);
    ELSIF NEW.statut <> 'annulee' AND coalesce(OLD.statut,'') = 'annulee' THEN
      PERFORM public.generate_ecriture_facture(NEW.facture_id);
    ELSIF NEW.montant_total <> OLD.montant_total AND NEW.statut <> 'annulee' THEN
      PERFORM public._delete_ecriture_piece('FACT:' || NEW.facture_id::text);
      PERFORM public.generate_ecriture_facture(NEW.facture_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_factures_ecriture ON public.factures;
CREATE TRIGGER trg_factures_ecriture AFTER INSERT OR UPDATE OR DELETE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public._trg_facture_ecriture();

CREATE OR REPLACE FUNCTION public._trg_paiement_ecriture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._delete_ecriture_piece('PAI:' || OLD.paiement_id::text);
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.statut = 'valide' THEN PERFORM public.generate_ecriture_paiement(NEW.paiement_id); END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.statut = 'valide' AND coalesce(OLD.statut,'') <> 'valide' THEN
      PERFORM public.generate_ecriture_paiement(NEW.paiement_id);
    ELSIF NEW.statut <> 'valide' AND coalesce(OLD.statut,'') = 'valide' THEN
      PERFORM public._delete_ecriture_piece('PAI:' || NEW.paiement_id::text);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_paiements_ecriture ON public.paiements;
CREATE TRIGGER trg_paiements_ecriture AFTER INSERT OR UPDATE OR DELETE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public._trg_paiement_ecriture();

-- Contrôle : factures et paiements comptabilisés plus d'une fois (écritures actives,
-- y compris celles de l'ancien déclencheur, repérées par source_type / source_id).
-- Lecture seule (comptabilite.voir) ; doublons à corriger par contre-passation.
CREATE OR REPLACE FUNCTION public.compta_pieces_comptabilisees_plusieurs_fois()
RETURNS TABLE(type_piece text, piece_id uuid, reference text, nb_ecritures bigint, montant_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ecr AS (
    SELECT e.ecriture_id, e.montant_total,
           CASE WHEN e.piece_ref LIKE 'FACT:%' THEN 'facture'
                WHEN e.piece_ref LIKE 'PAI:%' THEN 'paiement'
                WHEN e.piece_ref IS NULL AND e.source_type = 'facture' THEN 'facture'
                WHEN e.piece_ref IS NULL AND e.source_type = 'paiement' THEN 'paiement' END AS type_piece,
           CASE WHEN e.piece_ref ~ '^(FACT|PAI):[0-9a-f-]{36}$' THEN split_part(e.piece_ref, ':', 2)::uuid
                WHEN e.piece_ref IS NULL THEN e.source_id END AS piece_id
      FROM public.ecritures_comptables e
     WHERE e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL
  )
  SELECT ecr.type_piece, ecr.piece_id,
         coalesce((SELECT f.reference FROM public.factures f WHERE f.facture_id = ecr.piece_id),
                  (SELECT p.reference FROM public.paiements p WHERE p.paiement_id = ecr.piece_id)),
         count(*), sum(ecr.montant_total)
    FROM ecr
   WHERE ecr.type_piece IS NOT NULL AND ecr.piece_id IS NOT NULL
     AND public.has_permission(auth.uid(), 'comptabilite.voir')
   GROUP BY ecr.type_piece, ecr.piece_id
  HAVING count(*) > 1;
$$;
REVOKE ALL ON FUNCTION public.compta_pieces_comptabilisees_plusieurs_fois() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_pieces_comptabilisees_plusieurs_fois() TO authenticated;

-- ─── 2. Transactions : montant positif, historique conservé ─────────────────
-- NOT VALID : contrôle les nouvelles lignes sans bloquer sur d'éventuelles
-- anciennes valeurs (à lister et corriger).
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_montant_positif;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_montant_positif CHECK (montant > 0) NOT VALID;

-- Une transaction validée ne se supprime pas et ne se modifie plus : on l'annule
-- (statut « annule »), ce qui la retire des totaux en gardant la trace.
CREATE OR REPLACE FUNCTION public.trg_transactions_historique()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public._compta_contexte_technique() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut = 'en_attente' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Transaction % : suppression interdite, l''annuler', OLD.reference
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.statut = 'annule' THEN
    RAISE EXCEPTION 'Transaction % annulée : elle ne se modifie plus', OLD.reference
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.statut = 'valide' AND NEW.statut <> 'annule'
     AND (NEW.montant IS DISTINCT FROM OLD.montant OR NEW.type IS DISTINCT FROM OLD.type
          OR NEW.date_transaction IS DISTINCT FROM OLD.date_transaction
          OR NEW.statut IS DISTINCT FROM OLD.statut) THEN
    RAISE EXCEPTION 'Transaction % validée : montant, type, date et statut ne changent plus (l''annuler puis la ressaisir)',
      OLD.reference USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_transactions_historique ON public.transactions;
CREATE TRIGGER trg_transactions_historique BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_transactions_historique();
