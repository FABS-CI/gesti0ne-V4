CREATE OR REPLACE FUNCTION public._renommage_doc_tables()
RETURNS TABLE(t text, pk text) LANGUAGE sql IMMUTABLE AS $$
  VALUES ('commandes','commande_id'),('factures','facture_id'),('proformas','proforma_id'),
         ('bons_livraison','bl_id'),('livraisons','livraison_id'),('retours','retour_id'),('specimens','specimen_id');
$$;

CREATE OR REPLACE FUNCTION public.renommage_clients_appliquer_lot(_lot_id uuid, _items jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; v_cl record; v_new text; n int := 0; r record;
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
    FOR r IN SELECT * FROM public._renommage_doc_tables() LOOP
      EXECUTE format(
        'INSERT INTO public.client_renommage_docs(lot_id, table_name, doc_id, ancien_client_nom)
         SELECT $3, %2$L, %3$I::text, client_nom FROM public.%1$I WHERE client_id = $2 AND client_nom IS DISTINCT FROM $1',
        r.t, r.t, r.pk) USING v_new, v_cl.client_id, _lot_id;
      EXECUTE format('UPDATE public.%I SET client_nom = $1 WHERE client_id = $2 AND client_nom IS DISTINCT FROM $1', r.t)
        USING v_new, v_cl.client_id;
    END LOOP;
    n := n + 1;
  END LOOP;
  UPDATE public.client_renommage_lots SET nb_renommes = nb_renommes + n WHERE lot_id = _lot_id;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.renommage_clients_annuler_lot(_lot_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; d record; n int := 0; v_pk text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_renommage_lots WHERE lot_id = _lot_id AND statut IN ('applique','en_cours')) THEN
    RAISE EXCEPTION 'Ce renommage est déjà annulé';
  END IF;
  PERFORM set_config('app.renommage_clients', 'on', true);
  FOR d IN SELECT * FROM public.client_renommage_docs WHERE lot_id = _lot_id ORDER BY id DESC LOOP
    SELECT pk INTO v_pk FROM public._renommage_doc_tables() WHERE t = d.table_name;
    IF v_pk IS NULL THEN CONTINUE; END IF;
    EXECUTE format('UPDATE public.%I SET client_nom = $1 WHERE %I::text = $2', d.table_name, v_pk)
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
REVOKE ALL ON FUNCTION public._renommage_doc_tables() FROM PUBLIC, anon, authenticated;