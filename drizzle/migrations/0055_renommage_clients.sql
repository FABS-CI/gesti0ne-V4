ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ancien_nom text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS type_renommage text CHECK (type_renommage IN ('LIBRAIRIE','PAPETERIE'));

CREATE TABLE public.client_renommage_exclusions (
  reference text PRIMARY KEY,
  motif text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.client_renommage_lots (
  lot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_by_email text,
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','applique','annule')),
  nb_clients_avant int, nb_clients_apres int,
  nb_debiteurs_avant int, nb_debiteurs_apres int,
  total_impaye_avant numeric, total_impaye_apres numeric,
  nb_renommes int NOT NULL DEFAULT 0,
  annule_le timestamptz, annule_par uuid
);
CREATE TABLE public.client_renommage_journal (
  id bigserial PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES public.client_renommage_lots(lot_id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  reference text,
  ancien_nom text NOT NULL,
  nouveau_nom text NOT NULL,
  ancien_nom_sauve_avant text,
  type_avant text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.client_renommage_journal(lot_id);
CREATE TABLE public.client_renommage_docs (
  id bigserial PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES public.client_renommage_lots(lot_id) ON DELETE CASCADE,
  table_name text NOT NULL,
  doc_id text NOT NULL,
  ancien_client_nom text
);
CREATE INDEX ON public.client_renommage_docs(lot_id);

GRANT SELECT, INSERT, DELETE ON public.client_renommage_exclusions TO authenticated;
GRANT SELECT ON public.client_renommage_lots, public.client_renommage_journal TO authenticated;
GRANT ALL ON public.client_renommage_exclusions, public.client_renommage_lots, public.client_renommage_journal, public.client_renommage_docs TO service_role;
ALTER TABLE public.client_renommage_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_renommage_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_renommage_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_renommage_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin exclusions" ON public.client_renommage_exclusions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin lots" ON public.client_renommage_lots FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admin journal" ON public.client_renommage_journal FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ancien_nom : non modifiable une fois posé, sauf par les opérations de renommage
CREATE OR REPLACE FUNCTION public._clients_protect_ancien_nom() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ancien_nom IS DISTINCT FROM OLD.ancien_nom
     AND coalesce(current_setting('app.renommage_clients', true), '') <> 'on' THEN
    NEW.ancien_nom := OLD.ancien_nom;
  END IF;
  IF NEW.type_renommage IS DISTINCT FROM OLD.type_renommage
     AND coalesce(current_setting('app.renommage_clients', true), '') <> 'on' THEN
    NEW.type_renommage := OLD.type_renommage;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_clients_protect_ancien_nom BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public._clients_protect_ancien_nom();

CREATE OR REPLACE FUNCTION public._renommage_controle()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nb_clients', count(*),
    'nb_debiteurs', count(*) FILTER (WHERE solde > 0),
    'total_impaye', coalesce(sum(solde) FILTER (WHERE solde > 0), 0))
  FROM public.clients;
$$;

CREATE OR REPLACE FUNCTION public.renommage_clients_controle()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501'; END IF;
  RETURN public._renommage_controle();
END $$;

CREATE OR REPLACE FUNCTION public.renommage_clients_ouvrir_lot()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb; v_lot uuid; v_email text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.client_renommage_lots WHERE statut = 'en_cours' AND created_at > now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Un renommage est déjà en cours';
  END IF;
  c := public._renommage_controle();
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.client_renommage_lots(created_by, created_by_email, nb_clients_avant, nb_debiteurs_avant, total_impaye_avant)
  VALUES (auth.uid(), v_email, (c->>'nb_clients')::int, (c->>'nb_debiteurs')::int, (c->>'total_impaye')::numeric)
  RETURNING lot_id INTO v_lot;
  RETURN v_lot;
END $$;

-- _items : [{client_id, nouveau_nom, type}]
CREATE OR REPLACE FUNCTION public.renommage_clients_appliquer_lot(_lot_id uuid, _items jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; v_cl record; v_new text; n int := 0; t text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_renommage_lots WHERE lot_id = _lot_id AND statut = 'en_cours') THEN
    RAISE EXCEPTION 'Lot de renommage introuvable ou clôturé';
  END IF;
  PERFORM set_config('app.renommage_clients', 'on', true);
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_new := upper(btrim(regexp_replace(it->>'nouveau_nom', '\s+', ' ', 'g')));
    IF v_new IS NULL OR v_new = '' THEN CONTINUE; END IF;
    SELECT client_id, reference, nom, ancien_nom, type_renommage INTO v_cl
      FROM public.clients WHERE client_id = (it->>'client_id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_cl.nom = v_new THEN CONTINUE; END IF;
    INSERT INTO public.client_renommage_journal(lot_id, client_id, reference, ancien_nom, nouveau_nom, ancien_nom_sauve_avant, type_avant)
    VALUES (_lot_id, v_cl.client_id, v_cl.reference, v_cl.nom, v_new, v_cl.ancien_nom, v_cl.type_renommage);
    UPDATE public.clients SET
      ancien_nom = coalesce(ancien_nom, nom),
      type_renommage = coalesce(type_renommage, nullif(it->>'type', '')),
      nom = v_new
    WHERE client_id = v_cl.client_id;
    FOREACH t IN ARRAY ARRAY['commandes','factures','proformas','bons_livraison','livraisons','retours','specimens','bons_retour'] LOOP
      EXECUTE format(
        'WITH d AS (UPDATE public.%1$I x SET client_nom = $1 FROM public.%1$I o
           WHERE x.ctid = o.ctid AND x.client_id = $2 AND x.client_nom IS DISTINCT FROM $1
           RETURNING o.ctid::text AS doc_id, o.client_nom AS ancien)
         INSERT INTO public.client_renommage_docs(lot_id, table_name, doc_id, ancien_client_nom)
         SELECT $3, %1$L, doc_id, ancien FROM d', t)
      USING v_new, v_cl.client_id, _lot_id;
    END LOOP;
    n := n + 1;
  END LOOP;
  UPDATE public.client_renommage_lots SET nb_renommes = nb_renommes + n WHERE lot_id = _lot_id;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.renommage_clients_cloturer_lot(_lot_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb; l record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501'; END IF;
  SELECT * INTO l FROM public.client_renommage_lots WHERE lot_id = _lot_id AND statut = 'en_cours';
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot de renommage introuvable ou clôturé'; END IF;
  c := public._renommage_controle();
  UPDATE public.client_renommage_lots SET statut = 'applique',
    nb_clients_apres = (c->>'nb_clients')::int, nb_debiteurs_apres = (c->>'nb_debiteurs')::int,
    total_impaye_apres = (c->>'total_impaye')::numeric
  WHERE lot_id = _lot_id;
  RETURN c || jsonb_build_object('nb_clients_avant', l.nb_clients_avant, 'nb_debiteurs_avant', l.nb_debiteurs_avant, 'total_impaye_avant', l.total_impaye_avant);
END $$;

CREATE OR REPLACE FUNCTION public.renommage_clients_annuler_lot(_lot_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; d record; n int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_renommage_lots WHERE lot_id = _lot_id AND statut IN ('applique','en_cours')) THEN
    RAISE EXCEPTION 'Ce renommage est déjà annulé';
  END IF;
  PERFORM set_config('app.renommage_clients', 'on', true);
  FOR d IN SELECT * FROM public.client_renommage_docs WHERE lot_id = _lot_id ORDER BY id DESC LOOP
    EXECUTE format('UPDATE public.%I SET client_nom = $1 WHERE ctid = $2::tid', d.table_name)
      USING d.ancien_client_nom, d.doc_id;
  END LOOP;
  FOR j IN SELECT * FROM public.client_renommage_journal WHERE lot_id = _lot_id ORDER BY id DESC LOOP
    UPDATE public.clients SET nom = j.ancien_nom, ancien_nom = j.ancien_nom_sauve_avant, type_renommage = j.type_avant
    WHERE client_id = j.client_id;
    n := n + 1;
  END LOOP;
  UPDATE public.client_renommage_lots SET statut = 'annule', annule_le = now(), annule_par = auth.uid() WHERE lot_id = _lot_id;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public._renommage_controle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renommage_clients_controle(), public.renommage_clients_ouvrir_lot(), public.renommage_clients_appliquer_lot(uuid, jsonb), public.renommage_clients_cloturer_lot(uuid), public.renommage_clients_annuler_lot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renommage_clients_controle(), public.renommage_clients_ouvrir_lot(), public.renommage_clients_appliquer_lot(uuid, jsonb), public.renommage_clients_cloturer_lot(uuid), public.renommage_clients_annuler_lot(uuid) TO authenticated;