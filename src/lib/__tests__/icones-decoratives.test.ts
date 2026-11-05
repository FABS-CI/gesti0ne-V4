// Interface sans icônes décoratives : garde-fou des écrans déjà nettoyés.
//
// Règle : une icône n'est gardée que si elle sert à utiliser l'écran (case cochée,
// flèche de liste ou de tri, fermeture, chargement, menu d'options, mot de passe…).
// Titres, cartes, menus, boutons qui ont déjà un libellé : texte seul, sans emoji.
// Les écrans s'ajoutent à ECRANS_NETTOYES au fil des lots.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Icônes fonctionnelles autorisées. */
const ICONES_FONCTIONNELLES = new Set([
  "Check",
  "ChevronDown",
  "ChevronUp",
  "ChevronLeft",
  "ChevronRight",
  "ChevronsUpDown",
  "ChevronsLeft",
  "ChevronsRight",
  "X",
  "Loader2",
  "ArrowUpDown",
  "ArrowUp",
  "ArrowDown",
  "Eye",
  "EyeOff",
  "PanelLeft",
  "GripVertical",
  "MoreHorizontal",
  "MoreVertical",
  "Circle",
  "Minus",
  "Dot",
  "LucideIcon",
]);

const dossier = (d: string) =>
  readdirSync(d)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => join(d, f));

/** Lot 1 (05/11/2026) : tableaux de bord et navigation. */
const ECRANS_NETTOYES = [
  ...dossier("src/components/dashboard"),
  "src/routes/_authenticated/dashboard.index.tsx",
  "src/routes/_authenticated/compta-dashboard.tsx",
  "src/routes/_authenticated/paie-dashboard.tsx",
  "src/routes/_authenticated/rh-dashboard.tsx",
  "src/routes/_authenticated/dashboard-logistique.tsx",
  "src/routes/_authenticated/clients.dashboard.tsx",
  "src/components/security/SecurityDashboard.tsx",
  "src/components/layout/sidebar/SidebarNavItem.tsx",
  "src/components/layout/sidebar/SidebarNavGroup.tsx",
  "src/components/layout/MobileBottomNav.tsx",
  // Lot 2 (05/11/2026) : ventes, proformas, factures, paiements, composants communs.
  "src/components/clients/detail/ClientPaiementsTab.tsx",
  "src/components/commandes/CommandeActions.tsx",
  "src/components/commandes/CommandeForm.tsx",
  "src/components/commandes/CommandeRowMenu.tsx",
  "src/components/commandes/DocActionsMenu.tsx",
  "src/components/commandes/FloatingCalculator.tsx",
  "src/components/commandes/SolderFactureDialog.tsx",
  "src/components/commandes/VenteRapideDialog.tsx",
  "src/components/commandes/form/LignesSection.tsx",
  "src/components/commandes/list/CommandesCycleSteps.tsx",
  "src/components/commandes/list/CommandesKpis.tsx",
  "src/components/commandes/list/CommandesTable.tsx",
  "src/components/commandes/list/CommandesToolbar.tsx",
  "src/components/commandes/list/DeleteCommandeDialog.tsx",
  "src/components/common/EmptyState.tsx",
  "src/components/crud/ResourceManager.tsx",
  "src/components/crud/ResourceTable.tsx",
  "src/components/factures/list/FacturePdfActions.tsx",
  "src/components/factures/list/FacturesKpis.tsx",
  "src/components/factures/list/FneStatusBadge.tsx",
  "src/components/fne/FNEFacturesTab.tsx",
  "src/components/paiements/PaiementVentilationCard.tsx",
  "src/components/paiements/PaiementsEnAttenteCard.tsx",
  "src/components/paiements/nouveau/ClientsDebiteursSelector.tsx",
  "src/components/paiements/nouveau/PaiementFormCard.tsx",
  "src/components/rapports/analyse/VentesEncart.tsx",
  "src/components/ui/section-header.tsx",
  "src/routes/_authenticated/admin.audit-paiements.$auditId.tsx",
  "src/routes/_authenticated/admin.audit-paiements.index.tsx",
  "src/routes/_authenticated/commandes.$commandeId.index.tsx",
  "src/routes/_authenticated/commandes.$commandeId.modifier.tsx",
  "src/routes/_authenticated/commandes.index.tsx",
  "src/routes/_authenticated/commandes.nouvelle.tsx",
  "src/routes/_authenticated/factures.$factureId.tsx",
  "src/routes/_authenticated/factures.index.tsx",
  "src/routes/_authenticated/fne-detail.$factureId.tsx",
  "src/routes/_authenticated/livraison-suivi.$commandeRef.index.tsx",
  "src/routes/_authenticated/livraison-suivi.$commandeRef.remise.tsx",
  "src/routes/_authenticated/paiements.$paiementId.tsx",
  "src/routes/_authenticated/paiements.index.tsx",
  "src/routes/_authenticated/paiements.nouveau.tsx",
  "src/routes/_authenticated/proformas.$proformaId.tsx",
  "src/routes/_authenticated/proformas.index.tsx",
  // Lot 3 (05/11/2026) : stock, produits, inventaires, logistique, colisage, retours.
  "src/components/achats/nouveau/LignesProduitsSection.tsx",
  "src/components/colisage/ColisageActionButtons.tsx",
  "src/components/colisage/ColisageForm.tsx",
  "src/components/colisage/EtiquettesSection.tsx",
  "src/components/colisage/form/ColisageAcheminementFields.tsx",
  "src/components/colisage/form/ColisageCartonsSection.tsx",
  "src/components/data-quality/ReconciliationStockCard.tsx",
  "src/components/inventaires/detail/InventaireHeaderActions.tsx",
  "src/components/livraison-suivi/ConfirmerReceptionDialog.tsx",
  "src/components/livraison-suivi/LivraisonsTable.tsx",
  "src/components/logistics-costs/DetailDialog.tsx",
  "src/components/produits/ProductCoverActions.tsx",
  "src/components/produits/ProductCoverHero.tsx",
  "src/components/produits/ProductCoverSection.tsx",
  "src/components/produits/ProductCoverThumb.tsx",
  "src/components/produits/detail/DepotsStockTab.tsx",
  "src/components/produits/detail/InfoCards.tsx",
  "src/components/produits/detail/KpiCards.tsx",
  "src/components/produits/list/ProduitFormDialog.tsx",
  "src/components/produits/list/ProduitsFilters.tsx",
  "src/components/produits/list/ProduitsTable.tsx",
  "src/components/rapports/analyse/ProduitsTab.tsx",
  "src/components/retours/nouveau/DocumentSection.tsx",
  "src/components/retours/nouveau/LignesSection.tsx",
  "src/components/specimens/nouveau/LignesProduitsSection.tsx",
  "src/components/stock/DepotSortieField.tsx",
  "src/components/tournees/DateColisPicker.tsx",
  "src/components/tournees/create/ColisPickerTable.tsx",
  "src/routes/_authenticated/alertes-stock.tsx",
  "src/routes/_authenticated/bon-de-sortie.$tourneeId.tsx",
  "src/routes/_authenticated/bon-de-tournee.$tourneeId.tsx",
  "src/routes/_authenticated/bons-livraison.tsx",
  "src/routes/_authenticated/colisage.$blId.tsx",
  "src/routes/_authenticated/colisage.index.tsx",
  "src/routes/_authenticated/colisage.responsables.tsx",
  "src/routes/_authenticated/expeditions.tsx",
  "src/routes/_authenticated/fleet.tsx",
  "src/routes/_authenticated/inventaires.$inventaireId.tsx",
  "src/routes/_authenticated/inventaires.index.tsx",
  "src/routes/_authenticated/inventaires.nouveau-physique.tsx",
  "src/routes/_authenticated/livraison-suivi.index.tsx",
  "src/routes/_authenticated/livreurs.tsx",
  "src/routes/_authenticated/logistics-costs.tsx",
  "src/routes/_authenticated/missions.tsx",
  "src/routes/_authenticated/parametres.zones-livraison.tsx",
  "src/routes/_authenticated/pilotage.tsx",
  "src/routes/_authenticated/produits.$produitId.tsx",
  "src/routes/_authenticated/produits.index.tsx",
  "src/routes/_authenticated/rapports-logistique.tsx",
  "src/routes/_authenticated/rapports.transport.tsx",
  "src/routes/_authenticated/retours.$retourId.tsx",
  "src/routes/_authenticated/retours.index.tsx",
  "src/routes/_authenticated/retours.nouveau.tsx",
  "src/routes/_authenticated/stock.audit.tsx",
  "src/routes/_authenticated/stock.index.tsx",
  "src/routes/_authenticated/stock_.$produitId.mouvements.tsx",
  "src/routes/_authenticated/tournees-bl.$tourneeId.tsx",
  "src/routes/_authenticated/tournees.$tourneeId.tsx",
  "src/routes/_authenticated/tournees.index.tsx",
  "src/routes/_authenticated/tournees.nouvelle.tsx",
  "src/routes/carton.$colisId.tsx",
];

const EMOJI = /\p{Extended_Pictographic}/u;
const IMPORT_LUCIDE = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"lucide-react"/g;

function iconesImportees(src: string): string[] {
  const noms: string[] = [];
  for (const m of src.matchAll(IMPORT_LUCIDE)) {
    for (const brut of m[1].split(",")) {
      const nom = brut
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0];
      if (nom) noms.push(nom);
    }
  }
  return noms;
}

describe("écrans sans icônes décoratives", () => {
  for (const f of ECRANS_NETTOYES) {
    const src = readFileSync(f, "utf8");
    it(`${f} : seulement des icônes fonctionnelles`, () => {
      expect(iconesImportees(src).filter((n) => !ICONES_FONCTIONNELLES.has(n))).toEqual([]);
    });
    it(`${f} : aucun emoji`, () => {
      // ©, ® et ™ sont des mentions légales, pas des emojis.
      expect(EMOJI.test(src.replace(/[©®™]/g, ""))).toBe(false);
    });
    it(`${f} : aucune icône affichée depuis les données (item.icon, Icon)`, () => {
      expect(src).not.toMatch(/<(?:Icon|GroupIcon|\w+\.icon)\b/);
    });
  }
});
