import type { QueryClient } from "@tanstack/react-query";

/**
 * Helpers d'invalidation React Query centralisés.
 *
 * Après chaque mutation métier, appeler le helper correspondant depuis le
 * `onSuccess` d'une `useMutation` pour rafraîchir automatiquement toutes les
 * vues qui exposent les données touchées (fiches, listes, dashboards, KPI,
 * rapports).
 *
 * Convention : passer les IDs connus (`clientId`, `factureId`…) permet une
 * invalidation ciblée ; les listes/agrégats sont toujours invalidés.
 */

// -------- Base scopes -----------------------------------------------------

export function invalidateDashboards(qc: QueryClient): void {
  const keys = [
    ["dashboard-overview"],
    ["dashboard-kpis"],
    ["compta-dashboard"],
    ["crm-dashboard"],
    ["paie-dashboard"],
    ["global-ventes"],
    ["global-compta"],
    ["global-rh"],
    ["global-stock"],
    ["widget"],
    ["balance"],
    ["grand-livre"],
    ["fec-ecritures"],
    ["etat-compte"],
  ];
  for (const k of keys) qc.invalidateQueries({ queryKey: k });
}

export function invalidateClient(qc: QueryClient, clientId?: string): void {
  qc.invalidateQueries({ queryKey: ["clients"] });
  qc.invalidateQueries({ queryKey: ["clients-mini"] });
  qc.invalidateQueries({ queryKey: ["crm-facets"] });
  const scoped = [
    "client",
    "client-info",
    "client-historique",
    "client-relations",
    "client-encours",
    "client-audit",
    "colisage-client-info",
    "factures-impayees",
  ];
  for (const key of scoped) {
    qc.invalidateQueries({ queryKey: clientId ? [key, clientId] : [key] });
  }
}

export function invalidateFournisseur(qc: QueryClient, fournisseurId?: string): void {
  qc.invalidateQueries({ queryKey: ["fournisseurs"] });
  if (fournisseurId) {
    qc.invalidateQueries({ queryKey: ["fournisseur", fournisseurId] });
    qc.invalidateQueries({ queryKey: ["fournisseur-achats", fournisseurId] });
  } else {
    qc.invalidateQueries({ queryKey: ["fournisseur"] });
    qc.invalidateQueries({ queryKey: ["fournisseur-achats"] });
  }
}

export function invalidateStock(qc: QueryClient): void {
  const keys = [
    ["depots"],
    ["depots-stock-counts"],
    ["ligne-stock"],
    ["alertes-stock"],
    ["inventaires"],
    ["stock_mouvements"],
    ["stock"],
    ["stocks-depots"],
    ["produits"],
    ["produit"],
    ["global-stock"],
    ["dq", "stock"],
  ];
  for (const k of keys) qc.invalidateQueries({ queryKey: k });
  invalidateDashboards(qc);
}

// -------- Composed scopes -------------------------------------------------

export function invalidateFacture(
  qc: QueryClient,
  opts: { factureId?: string; clientId?: string } = {},
): void {
  qc.invalidateQueries({ queryKey: ["factures"] });
  qc.invalidateQueries({ queryKey: ["factures-paginated"] });
  qc.invalidateQueries({ queryKey: ["fne-list"] });
  qc.invalidateQueries({ queryKey: ["fne-stats"] });
  qc.invalidateQueries({ queryKey: ["fne-by-factures"] });
  // La suppression/annulation d'une facture cascade sur les paiements liés :
  // on rafraîchit systématiquement les listes de paiements et l'audit d'annulation.
  qc.invalidateQueries({ queryKey: ["paiements"] });
  qc.invalidateQueries({ queryKey: ["paiement-annulations-audit"] });
  if (opts.factureId) {
    qc.invalidateQueries({ queryKey: ["facture", opts.factureId] });
    qc.invalidateQueries({ queryKey: ["facture-paiements", opts.factureId] });
    qc.invalidateQueries({ queryKey: ["fne-facture", opts.factureId] });
    qc.invalidateQueries({ queryKey: ["fne-invoice", opts.factureId] });
  }
  invalidateClient(qc, opts.clientId);
  invalidateDashboards(qc);
}

export function invalidatePaiement(
  qc: QueryClient,
  opts: { paiementId?: string; factureId?: string; clientId?: string } = {},
): void {
  qc.invalidateQueries({ queryKey: ["paiements"] });
  qc.invalidateQueries({ queryKey: ["paiement-annulations-audit"] });
  if (opts.paiementId) qc.invalidateQueries({ queryKey: ["paiement", opts.paiementId] });
  invalidateFacture(qc, { factureId: opts.factureId, clientId: opts.clientId });
}

export function invalidateCommande(
  qc: QueryClient,
  opts: { commandeId?: string; clientId?: string } = {},
): void {
  qc.invalidateQueries({ queryKey: ["commandes"] });
  qc.invalidateQueries({ queryKey: ["bons_livraison"] });
  qc.invalidateQueries({ queryKey: ["bons-livraison-list"] });
  qc.invalidateQueries({ queryKey: ["colisage-bl-list"] });
  qc.invalidateQueries({ queryKey: ["livsuivi"] });
  // Cascades supplémentaires : suppression d'une commande impacte le stock,
  // les tournées, la comptabilité, les notifications, la fidélité et les
  // historiques. On invalide leurs listes/agrégats systématiquement.
  qc.invalidateQueries({ queryKey: ["stock-mouvements"] });
  qc.invalidateQueries({ queryKey: ["produits"] });
  qc.invalidateQueries({ queryKey: ["produits-mini"] });
  qc.invalidateQueries({ queryKey: ["stocks-depots"] });
  qc.invalidateQueries({ queryKey: ["tournees"] });
  qc.invalidateQueries({ queryKey: ["tournee"] });
  qc.invalidateQueries({ queryKey: ["bon-tournee"] });
  qc.invalidateQueries({ queryKey: ["bon-sortie"] });
  qc.invalidateQueries({ queryKey: ["ecritures"] });
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["fidelite"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
  qc.invalidateQueries({ queryKey: ["historique-envois"] });
  qc.invalidateQueries({ queryKey: ["incidents"] });
  qc.invalidateQueries({ queryKey: ["audit-logs"] });
  if (opts.commandeId) {
    qc.invalidateQueries({ queryKey: ["commande", opts.commandeId] });
    qc.invalidateQueries({ queryKey: ["commande-lignes", opts.commandeId] });
  }
  invalidateFacture(qc, { clientId: opts.clientId });
}

export function invalidateRetour(qc: QueryClient, opts: { clientId?: string } = {}): void {
  qc.invalidateQueries({ queryKey: ["retours"] });
  invalidateStock(qc);
  invalidateFacture(qc, { clientId: opts.clientId });
  qc.invalidateQueries({ queryKey: ["notifications"] });
  invalidateDashboards(qc);
}

export function invalidateColisage(
  qc: QueryClient,
  opts: { blId?: string; clientId?: string } = {},
): void {
  qc.invalidateQueries({ queryKey: ["colisage-bl-list"] });
  qc.invalidateQueries({ queryKey: ["bons-livraison-list"] });
  qc.invalidateQueries({ queryKey: ["colis-for-bl"] });
  if (opts.blId) qc.invalidateQueries({ queryKey: ["bl-detail", opts.blId] });
  // Cascade : la suppression d'un colisage impacte tournées, livraisons,
  // suivi de livraison et notifications.
  qc.invalidateQueries({ queryKey: ["tournees"] });
  qc.invalidateQueries({ queryKey: ["livraisons"] });
  qc.invalidateQueries({ queryKey: ["livraisons-commande"] });
  qc.invalidateQueries({ queryKey: ["livsuivi"] });
  qc.invalidateQueries({ queryKey: ["livsuivi-commandes"] });
  qc.invalidateQueries({ queryKey: ["expeditions"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
  invalidateCommande(qc, { clientId: opts.clientId });
}

export function invalidateAchat(
  qc: QueryClient,
  opts: { achatId?: string; fournisseurId?: string } = {},
): void {
  qc.invalidateQueries({ queryKey: ["achats"] });
  if (opts.achatId) {
    qc.invalidateQueries({ queryKey: ["achat", opts.achatId] });
    qc.invalidateQueries({ queryKey: ["achat-lignes", opts.achatId] });
  }
  invalidateFournisseur(qc, opts.fournisseurId);
  invalidateStock(qc);
  invalidateDashboards(qc);
}

/**
 * Filet de sécurité : invalide l'écosystème complet lié à un client
 * (fiche, historique, factures, paiements, retours, commandes, dashboards).
 * À utiliser quand plusieurs domaines sont touchés par une même opération
 * (ex. clôture d'exercice, annulation complexe).
 */
export function invalidateAllClientData(qc: QueryClient, clientId?: string): void {
  invalidateClient(qc, clientId);
  invalidateFacture(qc, { clientId });
  invalidatePaiement(qc, { clientId });
  invalidateCommande(qc, { clientId });
  invalidateRetour(qc, { clientId });
  invalidateDashboards(qc);
}

/** Toute transaction financière (recette/dépense) impacte CA, compta et dashboards. */
export function invalidateTransaction(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["finances"] });
  invalidateDashboards(qc);
}

/** Émission/annulation d'un spécimen : stock, mouvements, dashboards. */
export function invalidateSpecimen(qc: QueryClient, specimenId?: string): void {
  qc.invalidateQueries({ queryKey: ["specimens"] });
  if (specimenId) qc.invalidateQueries({ queryKey: ["specimen", specimenId] });
  invalidateStock(qc);
}

/** Soumission/annulation FNE : rafraîchit factures + statuts FNE + dashboards. */
export function invalidateFne(qc: QueryClient, factureId?: string): void {
  qc.invalidateQueries({ queryKey: ["fne-list"] });
  qc.invalidateQueries({ queryKey: ["fne-stats"] });
  qc.invalidateQueries({ queryKey: ["fne-by-factures"] });
  if (factureId) {
    qc.invalidateQueries({ queryKey: ["fne-facture", factureId] });
    qc.invalidateQueries({ queryKey: ["fne-invoice", factureId] });
  }
  invalidateFacture(qc, { factureId });
}
