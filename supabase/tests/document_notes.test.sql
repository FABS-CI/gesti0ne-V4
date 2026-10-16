-- Notes internes : contrôles d'accès et inaltérabilité. Exécuter dans une transaction annulée.
BEGIN;
DO $$
DECLARE
  v_noter uuid; v_lecteur uuid; v_facture uuid; v_note public.document_notes; ok boolean;
BEGIN
  SELECT ur.user_id INTO v_noter FROM rbac3_user_roles ur WHERE ur.role_code = 'comptable' LIMIT 1;
  SELECT ur.user_id INTO v_lecteur FROM rbac3_user_roles ur WHERE ur.role_code = 'commercial' LIMIT 1;
  SELECT facture_id INTO v_facture FROM factures LIMIT 1;

  -- Sans factures.noter (commercial : lecture seule) => refus
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lecteur, 'role','authenticated')::text, true);
  BEGIN PERFORM ajouter_note_document('facture', v_facture, 'x'); ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'refus sans factures.noter';

  -- Sans factures.voir (service_logistique) => refus
  PERFORM set_config('request.jwt.claims', json_build_object('sub',
    (SELECT user_id FROM rbac3_user_roles WHERE role_code='service_logistique' LIMIT 1),'role','authenticated')::text, true);
  BEGIN PERFORM ajouter_note_document('facture', v_facture, 'x'); ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'refus sans factures.voir';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_noter, 'role','authenticated')::text, true);
  BEGIN PERFORM ajouter_note_document('facture', gen_random_uuid(), 'x'); ok := false;
  EXCEPTION WHEN others THEN RAISE NOTICE 'msg=%', SQLERRM; ok := SQLERRM = 'Facture introuvable.'; END;
  ASSERT ok, 'facture inexistante';
  BEGIN PERFORM ajouter_note_document('facture', v_facture, '   '); ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM = 'La note est vide.'; END;
  ASSERT ok, 'note vide';
  BEGIN PERFORM ajouter_note_document('facture', v_facture, repeat('a', 2001)); ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'La note dépasse%'; END;
  ASSERT ok, 'note trop longue';

  v_note := ajouter_note_document('facture', v_facture, '  Client promet vendredi  ');
  ASSERT v_note.author_id = v_noter AND v_note.body = 'Client promet vendredi', 'auteur imposé et texte nettoyé';
  ASSERT EXISTS (SELECT 1 FROM document_timeline('facture', v_facture) t WHERE t.kind='note'), 'note dans le fil';

  BEGIN UPDATE document_notes SET body='y' WHERE id=v_note.id; ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'UPDATE refusé';
  BEGIN DELETE FROM document_notes WHERE id=v_note.id; ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'DELETE refusé';

  ASSERT NOT has_table_privilege('authenticated','public.document_notes','SELECT,INSERT'), 'aucun accès direct authenticated';
  ASSERT NOT has_table_privilege('anon','public.document_notes','SELECT'), 'aucun accès direct anon';
  RAISE NOTICE 'document_notes : tous les contrôles passent';
END $$;
ROLLBACK;
