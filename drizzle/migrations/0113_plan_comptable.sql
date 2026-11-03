-- Plan comptable (audit Comptabilité, phase 2).
--
-- Constats :
--   1. Le plan ne contenait que 7 comptes, alors que les écritures générées par l'ERP en
--      utilisent 15 (paie : 421, 422, 431, 447, 658, 661, 664, 758) : la balance affichait
--      ces comptes sans libellé, et rien ne permettait de vérifier un numéro.
--   2. La saisie manuelle acceptait n'importe quel numéro commençant par 1 à 9, avec un
--      libellé de compte libre : une faute de frappe créait un compte fantôme.
--   3. Aucune gestion : la page Plan comptable était vide ; un compte pouvait être supprimé
--      ou renuméroté directement en base alors que des écritures l'utilisaient.
--
-- Corrections :
--   - Classes 1 à 9, comptes principaux (2 chiffres) du SYSCOHADA révisé, comptes utilisés
--     par l'ERP et comptes de report à nouveau / résultat. Ajout seulement : un compte
--     existant garde son libellé.
--   - compta_plan_comptable : plan + mouvements par compte, et comptes utilisés absents du
--     plan. compta_plan_enregistrer / compta_plan_importer_absents : gestion tracée par droit.
--   - Un compte utilisé ne se supprime pas et ne change pas de numéro (on le désactive).
--   - Saisie manuelle : compte obligatoirement présent et actif dans le plan.

-- ─── 1. Classe, type et compte parent déduits du numéro ─────────────────────
CREATE OR REPLACE FUNCTION public._plan_type(_numero text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE left(_numero, 1)
           WHEN '1' THEN 'passif' WHEN '2' THEN 'actif' WHEN '3' THEN 'actif'
           WHEN '4' THEN 'tiers' WHEN '5' THEN 'tresorerie' WHEN '6' THEN 'charge'
           WHEN '7' THEN 'produit' WHEN '8' THEN 'hao' ELSE 'hors_bilan' END;
$$;

-- Parent : le plus long numéro du plan qui préfixe ce compte.
CREATE OR REPLACE FUNCTION public._plan_parent(_numero text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.numero FROM public.plan_comptable p
   WHERE _numero LIKE p.numero || '%' AND p.numero <> _numero
   ORDER BY length(p.numero) DESC LIMIT 1;
$$;

-- ─── 2. Référentiel SYSCOHADA révisé (ajout seulement) ──────────────────────
INSERT INTO public.plan_comptable (numero, libelle, classe, type)
SELECT v.numero, v.libelle, left(v.numero, 1)::int, public._plan_type(v.numero)
  FROM (VALUES
  ('1', 'Comptes de ressources durables'),
  ('2', 'Comptes d''actif immobilisé'),
  ('3', 'Comptes de stocks'),
  ('4', 'Comptes de tiers'),
  ('5', 'Comptes de trésorerie'),
  ('6', 'Comptes de charges des activités ordinaires'),
  ('7', 'Comptes de produits des activités ordinaires'),
  ('8', 'Comptes des autres charges et des autres produits'),
  ('9', 'Comptes des engagements hors bilan et comptabilité analytique'),
  ('10', 'Capital'),
  ('11', 'Réserves'),
  ('12', 'Report à nouveau'),
  ('13', 'Résultat net de l''exercice'),
  ('14', 'Subventions d''investissement'),
  ('15', 'Provisions réglementées et fonds assimilés'),
  ('16', 'Emprunts et dettes assimilées'),
  ('17', 'Dettes de location-acquisition'),
  ('18', 'Dettes liées à des participations et comptes de liaison'),
  ('19', 'Provisions financières pour risques et charges'),
  ('21', 'Immobilisations incorporelles'),
  ('22', 'Terrains'),
  ('23', 'Bâtiments, installations techniques et agencements'),
  ('24', 'Matériel, mobilier et actifs biologiques'),
  ('25', 'Avances et acomptes versés sur immobilisations'),
  ('26', 'Titres de participation'),
  ('27', 'Autres immobilisations financières'),
  ('28', 'Amortissements'),
  ('29', 'Dépréciations des immobilisations'),
  ('31', 'Marchandises'),
  ('32', 'Matières premières et fournitures liées'),
  ('33', 'Autres approvisionnements'),
  ('34', 'Produits en cours'),
  ('35', 'Services en cours'),
  ('36', 'Produits finis'),
  ('37', 'Produits intermédiaires et résiduels'),
  ('38', 'Stocks en cours de route, en consignation ou en dépôt'),
  ('39', 'Dépréciations des stocks et encours de production'),
  ('40', 'Fournisseurs et comptes rattachés'),
  ('41', 'Clients et comptes rattachés'),
  ('42', 'Personnel'),
  ('43', 'Organismes sociaux'),
  ('44', 'État et collectivités publiques'),
  ('45', 'Organismes internationaux'),
  ('46', 'Apporteurs, associés et groupe'),
  ('47', 'Débiteurs et créditeurs divers'),
  ('48', 'Créances et dettes hors activités ordinaires'),
  ('49', 'Dépréciations et provisions pour risques à court terme (tiers)'),
  ('50', 'Titres de placement'),
  ('51', 'Valeurs à encaisser'),
  ('52', 'Banques'),
  ('53', 'Établissements financiers et assimilés'),
  ('54', 'Instruments de trésorerie'),
  ('55', 'Instruments de monnaie électronique'),
  ('56', 'Banques, crédits de trésorerie et d''escompte'),
  ('57', 'Caisse'),
  ('58', 'Régies d''avances, accréditifs et virements internes'),
  ('59', 'Dépréciations et provisions pour risques à court terme (trésorerie)'),
  ('60', 'Achats et variations de stocks'),
  ('61', 'Transports'),
  ('62', 'Services extérieurs A'),
  ('63', 'Services extérieurs B'),
  ('64', 'Impôts et taxes'),
  ('65', 'Autres charges'),
  ('66', 'Charges de personnel'),
  ('67', 'Frais financiers et charges assimilées'),
  ('68', 'Dotations aux amortissements'),
  ('69', 'Dotations aux provisions et aux dépréciations'),
  ('70', 'Ventes'),
  ('71', 'Subventions d''exploitation'),
  ('72', 'Production immobilisée'),
  ('73', 'Variations des stocks de biens et de services produits'),
  ('75', 'Autres produits'),
  ('77', 'Revenus financiers et produits assimilés'),
  ('78', 'Transferts de charges'),
  ('79', 'Reprises de provisions, de dépréciations et autres'),
  ('81', 'Valeurs comptables des cessions d''immobilisations'),
  ('82', 'Produits des cessions d''immobilisations'),
  ('83', 'Charges hors activités ordinaires'),
  ('84', 'Produits hors activités ordinaires'),
  ('85', 'Dotations hors activités ordinaires'),
  ('86', 'Reprises hors activités ordinaires'),
  ('87', 'Participation des travailleurs'),
  ('88', 'Subventions d''équilibre'),
  ('89', 'Impôts sur le résultat'),
  -- Report à nouveau et résultat (clôture, affectation).
  ('121', 'Report à nouveau créditeur'),
  ('129', 'Report à nouveau débiteur'),
  ('131', 'Résultat net : bénéfice'),
  ('139', 'Résultat net : perte'),
  -- Comptes utilisés par les écritures générées de l'ERP.
  ('401', 'Fournisseurs, dettes en compte'),
  ('411', 'Clients'),
  ('421', 'Personnel, avances et acomptes'),
  ('422', 'Personnel, rémunérations dues'),
  ('431', 'Sécurité sociale'),
  ('447', 'État, impôts retenus à la source'),
  ('521', 'Banques locales'),
  ('571', 'Caisse siège social'),
  ('585', 'Virements de fonds'),
  ('601', 'Achats de marchandises'),
  ('658', 'Charges diverses'),
  ('661', 'Rémunérations directes versées au personnel national'),
  ('664', 'Charges sociales'),
  ('701', 'Ventes de marchandises'),
  ('758', 'Produits divers')
  ) AS v(numero, libelle)
 WHERE NOT EXISTS (SELECT 1 FROM public.plan_comptable p WHERE p.numero = v.numero);

-- Classe, type et parent des comptes qui n'en ont pas (y compris les comptes existants).
UPDATE public.plan_comptable SET classe = left(numero, 1)::int
 WHERE classe IS NULL AND numero ~ '^[1-9]';
UPDATE public.plan_comptable SET type = public._plan_type(numero) WHERE type IS NULL;
UPDATE public.plan_comptable p SET parent_numero = public._plan_parent(p.numero)
 WHERE p.parent_numero IS DISTINCT FROM public._plan_parent(p.numero);

-- ─── 3. Un compte utilisé ne se supprime pas et ne change pas de numéro ─────
CREATE OR REPLACE FUNCTION public._plan_compte_utilise(_compte_id uuid, _numero text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ecriture_lignes l
                  WHERE l.compte_id = _compte_id OR l.numero_compte = _numero);
$$;

CREATE OR REPLACE FUNCTION public.trg_plan_comptable_protege()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public._plan_compte_utilise(OLD.compte_id, OLD.numero) THEN
      RAISE EXCEPTION 'Compte % utilisé par des écritures : désactivez-le au lieu de le supprimer', OLD.numero
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.numero IS DISTINCT FROM OLD.numero
     AND public._plan_compte_utilise(OLD.compte_id, OLD.numero) THEN
    RAISE EXCEPTION 'Compte % utilisé par des écritures : son numéro ne peut plus changer', OLD.numero
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_plan_comptable_protege ON public.plan_comptable;
CREATE TRIGGER trg_plan_comptable_protege BEFORE UPDATE OR DELETE ON public.plan_comptable
  FOR EACH ROW EXECUTE FUNCTION public.trg_plan_comptable_protege();

-- ─── 4. Consultation : plan, mouvements, comptes absents du plan ────────────
CREATE OR REPLACE FUNCTION public.compta_plan_comptable()
RETURNS TABLE(compte_id uuid, numero text, libelle text, classe integer, type text,
              parent_numero text, actif boolean, dans_plan boolean,
              nb_lignes bigint, total_debit numeric, total_credit numeric, dernier_mouvement date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'plan_comptable.voir')
          OR public.has_permission(auth.uid(), 'comptabilite.voir')) THEN
    RAISE EXCEPTION 'Permission refusée : plan_comptable.voir' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH l AS (
    SELECT coalesce(nullif(btrim(el.numero_compte), ''), pci.numero) AS num,
           nullif(btrim(el.compte_libelle), '') AS lib,
           coalesce(el.debit, 0) AS d, coalesce(el.credit, 0) AS c, ec.date_ecriture
      FROM public.ecriture_lignes el
      JOIN public.ecritures_comptables ec ON ec.ecriture_id = el.ecriture_id
      LEFT JOIN public.plan_comptable pci ON pci.compte_id = el.compte_id
  ), m AS (
    SELECT l.num, min(l.lib) AS lib, count(*) AS n, sum(l.d) AS d, sum(l.c) AS c,
           max(l.date_ecriture) AS dernier
      FROM l WHERE l.num IS NOT NULL GROUP BY l.num
  )
  SELECT p.compte_id, p.numero, p.libelle, p.classe, p.type, p.parent_numero, p.actif, true,
         coalesce(m.n, 0), coalesce(m.d, 0), coalesce(m.c, 0), m.dernier
    FROM public.plan_comptable p LEFT JOIN m ON m.num = p.numero
  UNION ALL
  SELECT NULL::uuid, m.num, coalesce(m.lib, ''),
         CASE WHEN m.num ~ '^[1-9]' THEN left(m.num, 1)::int END, public._plan_type(m.num),
         public._plan_parent(m.num), true, false, m.n, m.d, m.c, m.dernier
    FROM m WHERE NOT EXISTS (SELECT 1 FROM public.plan_comptable p WHERE p.numero = m.num)
  ORDER BY 2;
END $$;
REVOKE ALL ON FUNCTION public.compta_plan_comptable() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_plan_comptable() TO authenticated;

-- ─── 5. Gestion des comptes ─────────────────────────────────────────────────
-- Création (p_compte_id NULL, droit plan_comptable.creer) ou modification (droit
-- plan_comptable.modifier). Le numéro d'un compte utilisé reste figé (déclencheur).
CREATE OR REPLACE FUNCTION public.compta_plan_enregistrer(
  p_compte_id uuid, p_numero text, p_libelle text, p_actif boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num text := btrim(coalesce(p_numero, '')); v_lib text := btrim(coalesce(p_libelle, ''));
        v_id uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(),
           CASE WHEN p_compte_id IS NULL THEN 'plan_comptable.creer' ELSE 'plan_comptable.modifier' END) THEN
    RAISE EXCEPTION 'Permission refusée : %',
      CASE WHEN p_compte_id IS NULL THEN 'plan_comptable.creer' ELSE 'plan_comptable.modifier' END
      USING ERRCODE = '42501';
  END IF;
  IF v_num !~ '^[1-9][0-9]{0,11}$' THEN
    RAISE EXCEPTION 'Numéro de compte invalide : chiffres uniquement, le premier étant la classe (1 à 9)';
  END IF;
  IF char_length(v_lib) < 2 OR char_length(v_lib) > 200 THEN
    RAISE EXCEPTION 'Libellé requis (2 à 200 caractères)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.plan_comptable
              WHERE numero = v_num AND compte_id IS DISTINCT FROM p_compte_id) THEN
    RAISE EXCEPTION 'Le compte % existe déjà', v_num;
  END IF;

  IF p_compte_id IS NULL THEN
    INSERT INTO public.plan_comptable (numero, libelle, classe, type, parent_numero, actif)
    VALUES (v_num, v_lib, left(v_num, 1)::int, public._plan_type(v_num),
            public._plan_parent(v_num), coalesce(p_actif, true))
    RETURNING compte_id INTO v_id;
  ELSE
    UPDATE public.plan_comptable
       SET numero = v_num, libelle = v_lib, classe = left(v_num, 1)::int,
           type = public._plan_type(v_num), actif = coalesce(p_actif, actif), updated_at = now()
     WHERE compte_id = p_compte_id
    RETURNING compte_id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Compte inconnu'; END IF;
  END IF;
  -- Parents à jour (un nouveau compte peut devenir le parent de comptes existants).
  UPDATE public.plan_comptable p SET parent_numero = public._plan_parent(p.numero)
   WHERE p.parent_numero IS DISTINCT FROM public._plan_parent(p.numero);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.compta_plan_enregistrer(uuid, text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_plan_enregistrer(uuid, text, text, boolean) TO authenticated;

-- Ajoute au plan les comptes utilisés par des écritures mais absents du plan, avec le
-- libellé le plus fréquent de leurs lignes. Retourne le nombre de comptes ajoutés.
CREATE OR REPLACE FUNCTION public.compta_plan_importer_absents()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'plan_comptable.creer') THEN
    RAISE EXCEPTION 'Permission refusée : plan_comptable.creer' USING ERRCODE = '42501';
  END IF;
  WITH l AS (
    SELECT btrim(el.numero_compte) AS num, nullif(btrim(el.compte_libelle), '') AS lib
      FROM public.ecriture_lignes el
     WHERE btrim(coalesce(el.numero_compte, '')) ~ '^[1-9][0-9]{0,11}$'
  ), absents AS (
    SELECT l.num,
           coalesce(mode() WITHIN GROUP (ORDER BY l.lib), 'Compte ' || l.num) AS lib
      FROM l
     WHERE NOT EXISTS (SELECT 1 FROM public.plan_comptable p WHERE p.numero = l.num)
     GROUP BY l.num
  ), ins AS (
    INSERT INTO public.plan_comptable (numero, libelle, classe, type)
    SELECT a.num, left(a.lib, 200), left(a.num, 1)::int, public._plan_type(a.num) FROM absents a
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM ins;
  UPDATE public.plan_comptable p SET parent_numero = public._plan_parent(p.numero)
   WHERE p.parent_numero IS DISTINCT FROM public._plan_parent(p.numero);
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.compta_plan_importer_absents() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_plan_importer_absents() TO authenticated;

-- ─── 6. Saisie manuelle : compte présent et actif dans le plan ──────────────
-- Reprise de 0108 ; ajout du contrôle de plan, libellé et compte_id du plan.
CREATE OR REPLACE FUNCTION public.compta_saisir_ecriture(
  p_date date, p_journal text, p_reference text, p_libelle text, p_lignes jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_n int; v_debit numeric; v_credit numeric; v_ref text; v_bad text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.creer') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.creer' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_libelle), '') = '' THEN RAISE EXCEPTION 'Libellé requis'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Date requise'; END IF;
  IF jsonb_typeof(p_lignes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Lignes invalides'; END IF;

  DROP TABLE IF EXISTS _lignes;
  CREATE TEMP TABLE _lignes ON COMMIT DROP AS
    SELECT btrim(l.compte) AS compte, nullif(btrim(l.compte_libelle), '') AS compte_libelle,
           round(coalesce(l.debit, 0), 2) AS debit, round(coalesce(l.credit, 0), 2) AS credit
      FROM jsonb_to_recordset(p_lignes) AS l(compte text, compte_libelle text, debit numeric, credit numeric)
     WHERE coalesce(btrim(l.compte), '') <> '' AND (coalesce(l.debit, 0) <> 0 OR coalesce(l.credit, 0) <> 0);

  SELECT compte INTO v_bad FROM _lignes
   WHERE debit < 0 OR credit < 0 OR (debit > 0 AND credit > 0) OR compte !~ '^[1-9]' LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Ligne invalide (compte %) : montants positifs, débit OU crédit, compte commençant par sa classe (1 à 9)', v_bad;
  END IF;
  SELECT l.compte INTO v_bad FROM _lignes l
   WHERE NOT EXISTS (SELECT 1 FROM public.plan_comptable p WHERE p.numero = l.compte AND p.actif)
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Compte % absent du plan comptable ou désactivé : ajoutez-le au plan d''abord', v_bad;
  END IF;
  SELECT count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0) INTO v_n, v_debit, v_credit FROM _lignes;
  IF v_n < 2 THEN RAISE EXCEPTION 'Au moins 2 lignes valides sont requises'; END IF;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Écriture déséquilibrée : débit % ≠ crédit %', v_debit, v_credit;
  END IF;

  v_ref := coalesce(nullif(btrim(p_reference), ''),
                    coalesce(nullif(btrim(p_journal), ''), 'OD') || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'));
  INSERT INTO public.ecritures_comptables
    (date_ecriture, journal, journal_id, reference, libelle, montant, montant_total, statut, source_type)
  VALUES (p_date, coalesce(nullif(btrim(p_journal), ''), 'OD'), public._journal_id(coalesce(nullif(btrim(p_journal), ''), 'OD')),
          v_ref, btrim(p_libelle), v_debit, v_debit, 'valide', 'manuel')
  RETURNING ecriture_id INTO v_id;
  -- Libellé de compte : celui du plan ; libellé de ligne : celui saisi, sinon le plan.
  INSERT INTO public.ecriture_lignes (ecriture_id, compte_id, compte, numero_compte, compte_libelle, libelle, debit, credit)
    SELECT v_id, p.compte_id, l.compte, l.compte, p.libelle, coalesce(l.compte_libelle, p.libelle), l.debit, l.credit
      FROM _lignes l JOIN public.plan_comptable p ON p.numero = l.compte;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.compta_saisir_ecriture(date, text, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_saisir_ecriture(date, text, text, text, jsonb) TO authenticated;
