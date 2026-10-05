-- Audit sécurité (fichier-56) — lot B : accès trop larges restants.

-- 1. Copie de sécurité des métadonnées de sauvegarde : RLS désactivée et lisible sans connexion.
REVOKE ALL ON public.backups_security_backup FROM anon, authenticated;
GRANT ALL ON public.backups_security_backup TO service_role;
ALTER TABLE public.backups_security_backup ENABLE ROW LEVEL SECURITY;

-- 2. Journaux alimentés uniquement par des fonctions serveur : plus d'insertion directe.
DROP POLICY IF EXISTS audit_stock_insert ON public.audit_stock;
DROP POLICY IF EXISTS couts_log_audit_insert_auth ON public.couts_logistiques_audit;
DROP POLICY IF EXISTS hist_envois_insert ON public.historique_envois;
DROP POLICY IF EXISTS livsuivi_historique_insert ON public.livsuivi_historique;

-- 3. Journal FNE : insertion réservée aux utilisateurs qui soumettent ou remboursent à la FNE.
DROP POLICY IF EXISTS fne_logs_insert ON public.fne_logs;
CREATE POLICY fne_logs_insert_perm ON public.fne_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission_v2(auth.uid(), 'fne.soumettre')
    OR public.has_permission_v2(auth.uid(), 'fne.reessayer')
    OR public.has_permission_v2(auth.uid(), 'fne.rembourser')
  );

-- 4. Compteurs de codes clients : lus seulement par le trigger serveur.
DROP POLICY IF EXISTS "Lecture compteurs codes clients" ON public.client_code_counters;

-- 5. Certifications : la lecture passe par le serveur (jetons non exposés aux utilisateurs).
DROP POLICY IF EXISTS doc_cert_authenticated_read ON public.document_certifications;