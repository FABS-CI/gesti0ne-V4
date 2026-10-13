# Annulation du Lot 2 (2026-10-13)

- 2.1 : aucune politique modifiée (aucune écriture permissive sur les tables financières) — rien à annuler.
- 2.2 : restaurer `src/lib/fne.functions.ts` et `src/lib/fne/submit.ts` de la version précédente.
  La table `fne_sign_locks` et l'index `fne_logs_action_created_idx` sont additifs et sans danger
  (pour débloquer une facture : `DELETE FROM public.fne_sign_locks WHERE facture_id = '<id>';`).
- 2.3 : restaurer `listCertificationsFn` dans `src/lib/certification/certification.functions.ts`.
- 2.5 : restaurer `src/routes/__root.tsx` (buster "v2") et `src/lib/auth/logout.ts` ; supprimer `src/lib/query-cache-user.ts`.
- 2.6 : retirer l'appel `applySecurityHeaders` de `src/server.ts`.
