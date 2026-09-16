-- Inventaires : colonnes attendues par l'application
ALTER TABLE public.inventaires
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS type_inventaire TEXT NOT NULL DEFAULT 'physique',
  ADD COLUMN IF NOT EXISTS categorie_id UUID REFERENCES public.categories_produits(categorie_id),
  ADD COLUMN IF NOT EXISTS nb_produits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_ecarts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valeur_totale NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observations TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_by_nom TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS regularized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exercice_id UUID REFERENCES public.exercices_comptables(exercice_id);

UPDATE public.inventaires SET numero = COALESCE(numero, reference), observations = COALESCE(observations, notes);

CREATE UNIQUE INDEX IF NOT EXISTS inventaires_numero_uidx ON public.inventaires(numero);
CREATE INDEX IF NOT EXISTS inventaires_exercice_idx ON public.inventaires(exercice_id);
CREATE INDEX IF NOT EXISTS inventaires_type_idx ON public.inventaires(type_inventaire);

ALTER TABLE public.inventaire_lignes
  ADD COLUMN IF NOT EXISTS reference_produit TEXT,
  ADD COLUMN IF NOT EXISTS stock_theorique NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantite_comptee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valeur_unitaire NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valeur_ecart NUMERIC NOT NULL DEFAULT 0;

UPDATE public.inventaire_lignes
   SET stock_theorique = COALESCE(quantite_theorique, 0),
       quantite_comptee = COALESCE(quantite_physique, 0);

-- Synchronisation ancien/nouveau nommage (aucun second système, une seule source)
CREATE OR REPLACE FUNCTION public._inventaire_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.numero := COALESCE(NEW.numero, NEW.reference);
    NEW.reference := COALESCE(NEW.reference, NEW.numero);
    NEW.observations := COALESCE(NEW.observations, NEW.notes);
    NEW.notes := COALESCE(NEW.notes, NEW.observations);
  ELSE
    IF NEW.numero IS DISTINCT FROM OLD.numero THEN NEW.reference := NEW.numero;
    ELSE NEW.numero := NEW.reference; END IF;
    IF NEW.observations IS DISTINCT FROM OLD.observations THEN NEW.notes := NEW.observations;
    ELSE NEW.observations := NEW.notes; END IF;
  END IF;
  IF NEW.exercice_id IS NULL THEN
    NEW.exercice_id := COALESCE(
      public._resolve_exercice_id(COALESCE(NEW.date_inventaire, CURRENT_DATE)),
      (SELECT exercice_id FROM public.exercices_comptables WHERE is_actif = true ORDER BY date_debut DESC LIMIT 1)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_inventaire_sync ON public.inventaires;
CREATE TRIGGER trg_inventaire_sync BEFORE INSERT OR UPDATE ON public.inventaires
FOR EACH ROW EXECUTE FUNCTION public._inventaire_sync();

CREATE OR REPLACE FUNCTION public._inventaire_ligne_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.stock_theorique,0) <> 0 AND COALESCE(NEW.quantite_theorique,0) = 0 THEN
      NEW.quantite_theorique := NEW.stock_theorique;
    ELSE
      NEW.stock_theorique := COALESCE(NEW.quantite_theorique, 0);
    END IF;
    IF COALESCE(NEW.quantite_comptee,0) <> 0 AND COALESCE(NEW.quantite_physique,0) = 0 THEN
      NEW.quantite_physique := NEW.quantite_comptee;
    ELSE
      NEW.quantite_comptee := COALESCE(NEW.quantite_physique, 0);
    END IF;
  ELSE
    IF NEW.stock_theorique IS DISTINCT FROM OLD.stock_theorique THEN NEW.quantite_theorique := NEW.stock_theorique;
    ELSE NEW.stock_theorique := COALESCE(NEW.quantite_theorique, 0); END IF;
    IF NEW.quantite_comptee IS DISTINCT FROM OLD.quantite_comptee THEN NEW.quantite_physique := NEW.quantite_comptee;
    ELSE NEW.quantite_comptee := COALESCE(NEW.quantite_physique, 0); END IF;
  END IF;
  NEW.ecart := COALESCE(NEW.quantite_comptee,0) - COALESCE(NEW.stock_theorique,0);
  NEW.valeur_ecart := NEW.ecart * COALESCE(NEW.valeur_unitaire, 0);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_inventaire_ligne_sync ON public.inventaire_lignes;
CREATE TRIGGER trg_inventaire_ligne_sync BEFORE INSERT OR UPDATE ON public.inventaire_lignes
FOR EACH ROW EXECUTE FUNCTION public._inventaire_ligne_sync();

-- Création : respecte le type, la catégorie, valorise les lignes
CREATE OR REPLACE FUNCTION public.creer_inventaire_physique(_payload jsonb)
RETURNS SETOF inventaires LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_ref text; v_depot uuid; v_cat uuid; v_type text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventaires.creer') THEN
    RAISE EXCEPTION 'Permission refusée : inventaires.creer' USING ERRCODE = '42501';
  END IF;

  v_ref := public._next_ref('INV', 'public.inventaires', 'reference');
  v_depot := NULLIF(_payload->>'depot_id','')::uuid;
  v_cat := NULLIF(_payload->>'categorie_id','')::uuid;
  v_type := COALESCE(NULLIF(_payload->>'type_inventaire',''), 'physique');

  INSERT INTO public.inventaires(reference, numero, type_inventaire, depot_id, categorie_id,
    date_inventaire, statut, notes, observations, created_by, created_by_nom)
  VALUES (v_ref, v_ref, v_type, v_depot, v_cat,
    COALESCE((_payload->>'date_inventaire')::date, current_date),
    'brouillon', _payload->>'observations', _payload->>'observations',
    auth.uid(), public._current_user_display_name())
  RETURNING inventaire_id INTO v_id;

  INSERT INTO public.inventaire_lignes(inventaire_id, produit_id, reference_produit, designation,
    stock_theorique, quantite_comptee, valeur_unitaire)
  SELECT v_id, p.produit_id, p.reference, p.titre,
         COALESCE(sd.quantite, 0), 0, COALESCE(p.prix_achat, 0)
  FROM public.produits p
  LEFT JOIN public.stocks_depots sd
    ON sd.produit_id = p.produit_id AND sd.depot_id = v_depot
  WHERE p.actif IS NOT FALSE
    AND (v_cat IS NULL OR p.categorie_id = v_cat);

  UPDATE public.inventaires i
     SET nb_produits = (SELECT count(*) FROM public.inventaire_lignes l WHERE l.inventaire_id = v_id),
         valeur_totale = (SELECT COALESCE(sum(l.stock_theorique * l.valeur_unitaire),0)
                            FROM public.inventaire_lignes l WHERE l.inventaire_id = v_id)
   WHERE i.inventaire_id = v_id;

  RETURN QUERY SELECT * FROM public.inventaires WHERE inventaire_id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.creer_inventaire_global(_payload jsonb)
RETURNS SETOF inventaires LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_ref text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventaires.creer') THEN
    RAISE EXCEPTION 'Permission refusée : inventaires.creer' USING ERRCODE = '42501';
  END IF;

  v_ref := public._next_ref('INV', 'public.inventaires', 'reference');

  INSERT INTO public.inventaires(reference, numero, type_inventaire, date_inventaire, statut,
    notes, observations, created_by, created_by_nom)
  VALUES (v_ref, v_ref, 'global', COALESCE((_payload->>'date_inventaire')::date, current_date),
    'brouillon', _payload->>'observations', _payload->>'observations',
    auth.uid(), public._current_user_display_name())
  RETURNING inventaire_id INTO v_id;

  INSERT INTO public.inventaire_lignes(inventaire_id, produit_id, reference_produit, designation,
    stock_theorique, quantite_comptee, valeur_unitaire)
  SELECT v_id, p.produit_id, p.reference, p.titre,
         COALESCE((SELECT sum(quantite) FROM public.stocks_depots sd WHERE sd.produit_id = p.produit_id), 0),
         0, COALESCE(p.prix_achat, 0)
  FROM public.produits p WHERE p.actif IS NOT FALSE;

  UPDATE public.inventaires i
     SET nb_produits = (SELECT count(*) FROM public.inventaire_lignes l WHERE l.inventaire_id = v_id),
         valeur_totale = (SELECT COALESCE(sum(l.stock_theorique * l.valeur_unitaire),0)
                            FROM public.inventaire_lignes l WHERE l.inventaire_id = v_id)
   WHERE i.inventaire_id = v_id;

  RETURN QUERY SELECT * FROM public.inventaires WHERE inventaire_id = v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.creer_inventaire_theorique(_payload jsonb)
RETURNS SETOF inventaires LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.creer_inventaire_physique(
    jsonb_set(COALESCE(_payload,'{}'::jsonb), '{type_inventaire}', '"theorique"'));
END; $$;

-- Validation : accepte quantite_comptee (nommage applicatif) ou quantite_physique
CREATE OR REPLACE FUNCTION public.valider_inventaire_physique(_inventaire_id uuid, _lignes jsonb)
RETURNS SETOF inventaires LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ligne jsonb; v_qte numeric; v_ecart_total numeric := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventaires.valider') THEN
    RAISE EXCEPTION 'Permission refusée : inventaires.valider' USING ERRCODE = '42501';
  END IF;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(COALESCE(_lignes,'[]'::jsonb)) LOOP
    v_qte := COALESCE((v_ligne->>'quantite_comptee')::numeric, (v_ligne->>'quantite_physique')::numeric, 0);
    UPDATE public.inventaire_lignes SET
      quantite_comptee = v_qte,
      stock_theorique = COALESCE((v_ligne->>'stock_theorique')::numeric,
                                 (v_ligne->>'quantite_theorique')::numeric, stock_theorique),
      observation = COALESCE(v_ligne->>'observation', observation)
    WHERE ligne_id = NULLIF(v_ligne->>'ligne_id','')::uuid
       OR (inventaire_id = _inventaire_id AND produit_id = NULLIF(v_ligne->>'produit_id','')::uuid);
  END LOOP;

  SELECT COALESCE(sum(abs(ecart)),0) INTO v_ecart_total
    FROM public.inventaire_lignes WHERE inventaire_id = _inventaire_id;

  UPDATE public.inventaires i SET
    statut = 'valide',
    validated_at = now(),
    ecart_total = v_ecart_total,
    nb_produits = (SELECT count(*) FROM public.inventaire_lignes l WHERE l.inventaire_id = _inventaire_id),
    nb_ecarts = (SELECT count(*) FROM public.inventaire_lignes l WHERE l.inventaire_id = _inventaire_id AND l.ecart <> 0),
    valeur_totale = (SELECT COALESCE(sum(l.quantite_comptee * l.valeur_unitaire),0)
                       FROM public.inventaire_lignes l WHERE l.inventaire_id = _inventaire_id),
    updated_at = now()
  WHERE i.inventaire_id = _inventaire_id;

  RETURN QUERY SELECT * FROM public.inventaires WHERE inventaire_id = _inventaire_id;
END; $$;

CREATE OR REPLACE FUNCTION public.regulariser_inventaire(_inventaire_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_depot uuid; r record;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventaires.regulariser') THEN
    RAISE EXCEPTION 'Permission refusée : inventaires.regulariser' USING ERRCODE = '42501';
  END IF;

  SELECT depot_id INTO v_depot FROM public.inventaires WHERE inventaire_id = _inventaire_id;

  FOR r IN SELECT produit_id, quantite_physique, ecart FROM public.inventaire_lignes
           WHERE inventaire_id = _inventaire_id AND produit_id IS NOT NULL LOOP
    IF v_depot IS NOT NULL THEN
      INSERT INTO public.stocks_depots(produit_id, depot_id, quantite)
      VALUES (r.produit_id, v_depot, r.quantite_physique)
      ON CONFLICT (produit_id, depot_id) DO UPDATE
        SET quantite = EXCLUDED.quantite, updated_at = now();

      INSERT INTO public.stock_mouvements(produit_id, depot_id, type, quantite,
        quantite_entree, quantite_sortie, stock_resultant, origine, document_id, user_id, motif)
      VALUES (r.produit_id, v_depot, 'ajustement', r.ecart,
        GREATEST(r.ecart,0), GREATEST(-r.ecart,0), r.quantite_physique,
        'inventaire', _inventaire_id, auth.uid(), 'Régularisation inventaire');
    END IF;
  END LOOP;

  UPDATE public.inventaires SET statut = 'regularise', regularized_at = now(), updated_at = now()
   WHERE inventaire_id = _inventaire_id;
END; $$;