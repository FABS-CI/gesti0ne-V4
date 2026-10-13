<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Les relevés clients calculent séparément paiements affectés et retours validés, puis les combinent une seule fois dans le solde, afin d'éviter tout double comptage.
- Un bon de retour dérivé d'une facture reprend les prix et remises effectifs de cette facture; le prix catalogue n'est qu'un secours pour les anciens retours sans facture.
- `sec_replace_user_scope` accepte un dépôt principal nullable; l'appeler uniquement via `replaceUserScope` (`src/lib/sec-replace-user-scope.ts`, seul cast étroit) et ne jamais remplacer `null` par un dépôt arbitraire pour satisfaire le type généré.
- Le Centre de pilotage lit uniquement la RPC agrégée `cockpit_overview`, qui filtre chaque bloc par `has_permission_v2` côté serveur; un bloc absent du JSON signifie « non autorisé », pour éviter de dupliquer les contrôles d'accès dans l'interface.
- The app sidebar becomes an overlay drawer below 1024 px (`useIsMobile(1024)` in sidebar.tsx) so tablets in portrait get full content width.
- Sales document references are stored unchanged (e.g. FAC-2026-00051) and only displayed via `formatDocumentReference` in `src/lib/document-reference.ts` (|FC|26|51); QR, certification, links and filenames keep the stored value so nothing technical breaks.
- Client codes (clients.reference) follow CL-[PREFIX]-[N], generated only by DB trigger via client_code_counters (never reused); old codes kept in clients.ancien_code. Why: unique, race-safe, auditable.
- Typecheck runs via `bun run typecheck` (tsgo from @typescript/native-preview); CI and scripts must call it, never `bunx tsgo`, because the bare "tsgo" npm package does not exist.
- Scheduled backup routes (`/api/public/backup/cron`, `hooks/global-backup`, `hooks/run-schedules`) authenticate only via `rejectUnlessCronAuthorized` (`src/lib/cron-auth.server.ts`, header `x-backup-secret`) and backups run only through `orchestrateBackup`, so there is one secret and one backup chain.
- Route guards use `ROUTE_TO_PERMISSION` keyed by real URLs (never file names like `stock_`); create/edit child routes require `.creer`/`.modifier`, and every route permission must be grantable through `expandRbac3Permissions`, enforced by `route-permissions.test.ts`.
- Vite pre-bundles the late-discovered router modules (optimizeDeps.include in vite.config.ts) so a mid-session re-optimization never loads two router copies and blanks the preview.
- DGI/FNE signing goes only through `signInvoiceWithDGI({ fne_id })`: the server checks `fne.soumettre`, rebuilds the request from the database, takes a `fne_sign_locks` row and logs to `fne_logs`, so a browser can never sign arbitrary content or sign twice.
- The persisted query cache (`fabs-query-cache`) is keyed per user via `queryCacheBuster` and wiped on logout/user change (`src/lib/query-cache-user.ts`), so one account never reads another's cached data.
- HTTP security headers are added in `src/server.ts` via `src/lib/security-headers.ts`; never add X-Frame-Options DENY or frame-ancestors 'none' because the Lovable preview frames the app.
- Document numbers come only from `_next_ref`, which increments `numerotation_compteurs` (type_doc, year) inside the caller's transaction; never compute MAX+1, so numbers are race-safe and never reused.
- Saved sales PDFs show the stored document total (`montantTotalStocke`); local recomputation is only for unsaved previews, and mismatches are logged via `signaler_ecart_total_document`.
- The sales analysis page (/rapports/analyse) keeps filters, tab, sort and page in the URL via validateSearch (`src/lib/rapports-search.ts`), so views survive refresh and can be shared; period shortcuts come only from `src/lib/rapports-periode.ts` (Africa/Abidjan calendar).
