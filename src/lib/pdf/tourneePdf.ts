/**
 * Générateurs PDF officiels pour le module Tournées Logistiques, alignés
 * sur la charte documentaire ERP FABS-CI (chrome jsPDF commun : logo,
 * en-tête, pied de page, pagination, A4 portrait).
 *
 * Deux documents :
 *  1. `generateBonTourneePDF` — BON DE TOURNÉE : planning opérationnel
 *     remis au chauffeur/transporteur (liste des livraisons/expéditions,
 *     récapitulatif, signatures).
 *  2. `generateBonSortieCaissePDF` — BON DE SORTIE DE CAISSE : document
 *     financier destiné à la Comptabilité pour autoriser et justifier le
 *     décaissement des frais de tournée (détail des frais, validation
 *     comptable, signatures).
 *
 * `generateBonSortiePDF` et `generateRecapCoutsTourneePDF` sont conservés
 * comme alias rétro-compatibles pointant sur le nouveau Bon de sortie de
 * caisse (les anciens appels dans l'UI ne cassent pas).
 */
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import {
  drawHeader,
  drawFooter,
  addPageNumbers,
  ensurePdfLogo,
  getPdfChromeBodyTop,
} from "@/lib/pdf/pdfChrome";
import { PDF_TABLE, getActiveTemplate } from "@/lib/pdf/pdfConfig";

// ---------------------------------------------------------------------------
// Helpers communs
// ---------------------------------------------------------------------------

async function fetchVehicule(vehiculeId: string | null): Promise<string> {
  if (!vehiculeId) return "—";
  const { data: v } = await supabase
    .from("vehicules")
    .select("immatriculation, marque, modele")
    .eq("vehicule_id", vehiculeId)
    .maybeSingle();
  if (!v) return "—";
  return `${v.immatriculation ?? ""} ${v.marque ?? ""} ${v.modele ?? ""}`.trim() || "—";
}

function drawInfoBlock(
  doc: import("jspdf").jsPDF,
  y: number,
  rows: Array<[string, string]>,
  marginX: number,
): number {
  doc.setFontSize(9);
  const pageW = doc.internal.pageSize.getWidth();
  const colWidth = (pageW - marginX * 2) / 2;
  rows.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = marginX + col * colWidth;
    const yy = y + row * 5;
    doc.setFont("helvetica", "bold");
    const label = `${k} :`;
    doc.text(label, x, yy);
    const labelW = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    const valX = x + labelW + 2;
    const maxW = colWidth - (labelW + 4);
    const val = doc.splitTextToSize(String(v ?? "—"), Math.max(20, maxW));
    doc.text(val[0] ?? "—", valX, yy);
  });
  return y + Math.ceil(rows.length / 2) * 5 + 4;
}

/**
 * Formate un montant en FCFA avec séparateur des milliers par espace simple.
 */
export function fmtMontant(v: number): string {
  return formatFCFA(v, false);
}

function drawSignatures(doc: import("jspdf").jsPDF, y: number, labels: string[], marginX = 14) {
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - marginX * 2;
  const cellW = usable / labels.length;
  const cellH = 26;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  labels.forEach((label, i) => {
    const x = marginX + i * cellW;
    doc.rect(x, y, cellW - 2, cellH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(label, x + 2, y + 4);
  });
  doc.setTextColor(0, 0, 0);
  return y + cellH + 4;
}

const STATUT_LIV_LABEL: Record<string, string> = {
  preparee: "Préparée",
  en_cours: "En cours",
  livree: "Livrée",
  expediee: "Expédiée",
  retiree: "Retirée",
  annulee: "Annulée",
};

/**
 * BON DE TOURNÉE — planning opérationnel remis au chauffeur/transporteur.
 * Format A4 portrait, chrome ERP FABS-CI.
 */
export async function generateBonTourneePDF(tourneeId: string): Promise<Blob> {
  const { data: t } = await supabase
    .from("tournees")
    .select(
      "tournee_id, reference, date_tournee, responsable_nom, chauffeur_nom, statut, notes, vehicule_id, type_tournee",
    )
    .eq("tournee_id", tourneeId)
    .maybeSingle();
  if (!t) throw new Error("Tournée introuvable");
  const vehicule = await fetchVehicule(t.vehicule_id);

  const { data: rows } = await supabase
    .from("livraisons_commande")
    .select(
      "livraison_id, statut, type_livraison, gare_nom, ville_livraison, nb_cartons, quantite_commandee, transporteur, commande_id, commandes:commande_id(reference, client_nom, client_id)",
    )
    .eq("tournee_id", tourneeId)
    .order("ville_livraison", { ascending: true });

  type Row = {
    statut: string | null;
    type_livraison: string | null;
    gare_nom: string | null;
    ville_livraison: string | null;
    nb_cartons: number | null;
    quantite_commandee: number | null;
    transporteur: string | null;
    commande_id: string | null;
    commandes: {
      reference: string | null;
      client_nom: string | null;
      client_id: string | null;
    } | null;
  };
  let list = (rows ?? []) as unknown as Row[];

  // Le suivi de livraison est la source créée lors de la validation d'une
  // tournée. Certaines tournées n'ont pas de ligne historique dans
  // `livraisons_commande` : le bon doit néanmoins afficher leurs commandes.
  if (list.length === 0) {
    const { data: suiviRows } = await supabase
      .from("livsuivi_commandes")
      .select(
        "statut, type_livraison, gare_depot, gare_destination, ville_destination, nb_cartons, commande_id, commandes:commande_id(reference, client_nom, client_id)",
      )
      .eq("tournee_id", tourneeId)
      .order("ordre_passage", { ascending: true });
    list = ((suiviRows ?? []) as unknown as Array<{
      statut: string | null;
      type_livraison: string | null;
      gare_depot: string | null;
      gare_destination: string | null;
      ville_destination: string | null;
      nb_cartons: number | null;
      commande_id: string | null;
      commandes: Row["commandes"];
    }>).map((r) => ({
      statut: r.statut,
      type_livraison: r.type_livraison,
      gare_nom: r.gare_destination ?? r.gare_depot,
      ville_livraison: r.ville_destination,
      nb_cartons: r.nb_cartons,
      quantite_commandee: null,
      transporteur: null,
      commande_id: r.commande_id,
      commandes: r.commandes,
    }));
  }

  // Enrichissement clients (téléphone / adresse) en un seul appel
  const clientIds = Array.from(
    new Set(list.map((r) => r.commandes?.client_id).filter(Boolean) as string[]),
  );
  const clientMap = new Map<string, { telephone: string | null; adresse: string | null }>();
  if (clientIds.length) {
    const { data: clients } = await supabase
      .from("clients")
      .select("client_id, telephone, adresse")
      .in("client_id", clientIds);
    (clients ?? []).forEach((c) => {
      clientMap.set(c.client_id, {
        telephone: c.telephone ?? null,
        adresse: c.adresse ?? null,
      });
    });
  }

  // Colis liés à la tournée (pour poids et destinataire)
  const { data: colisRows } = await supabase
    .from("colis")
    .select("commande_id, nb_cartons, destinataire, mode_acheminement")
    .eq("tournee_id" as never, tourneeId as never);
  const colisMap = new Map<string, { destinataire: string | null; cartons: number }>();
  (
    (colisRows ?? []) as Array<{
      commande_id: string | null;
      nb_cartons: number | null;
      destinataire: string | null;
      mode_acheminement?: string | null;
    }>
  ).forEach((c) => {
    if (!c.commande_id) return;
    const prev = colisMap.get(c.commande_id);
    colisMap.set(c.commande_id, {
      destinataire: prev?.destinataire ?? c.destinataire ?? null,
      // Règle métier : 1 référence de colis = 1 carton physique.
      cartons: (prev?.cartons ?? 0) + 1,
    });
  });

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  await ensurePdfLogo();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginX = 14;
  const template = getActiveTemplate();
  const titre = "BON DE TOURNEE";
  drawHeader(doc, titre, template);
  let y = getPdfChromeBodyTop();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`N° Bon de tournée : BT-${t.reference}`, marginX, y);
  y += 6;

  const isExpedition = (t.type_tournee ?? "").toLowerCase().includes("exped");
  y = drawInfoBlock(
    doc,
    y,
    [
      ["N° tournée", t.reference],
      ["Date", t.date_tournee ?? "—"],
      ["Responsable logistique", t.responsable_nom ?? "—"],
      [isExpedition ? "Transporteur" : "Chauffeur", t.chauffeur_nom ?? "—"],
      ["Véhicule", vehicule],
      ["Type", t.type_tournee ?? "Livraison directe"],
    ],
    marginX,
  );

  if (t.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Observations :", marginX, y);
    doc.setFont("helvetica", "normal");
    const obs = doc.splitTextToSize(String(t.notes), 180);
    doc.text(obs, marginX, y + 4);
    y += 4 + obs.length * 4 + 2;
  }

  // Totaux
  let totalColis = 0;
  let totalCartons = 0;
  const clientsSet = new Set<string>();
  let nbLivraisons = 0;
  let nbExpeditions = 0;

  // Références colis (cartons) par commande, pour la section détaillée
  const cartonsByCmd = new Map<string, string[]>();
  const { data: colisRefRows } = await supabase
    .from("colis")
    .select("commande_id, reference")
    .eq("tournee_id" as never, tourneeId as never)
    .order("reference");
  (
    (colisRefRows ?? []) as Array<{ commande_id: string | null; reference: string | null }>
  ).forEach((c) => {
    if (!c.commande_id || !c.reference) return;
    const arr = cartonsByCmd.get(c.commande_id) ?? [];
    arr.push(c.reference);
    cartonsByCmd.set(c.commande_id, arr);
  });

  const body = list.map((r) => {
    const nom = r.commandes?.client_nom ?? "—";
    clientsSet.add(nom);
    const infoCli = r.commandes?.client_id ? clientMap.get(r.commandes.client_id) : undefined;
    const colis = r.commande_id ? colisMap.get(r.commande_id) : undefined;
    const refs = r.commande_id ? (cartonsByCmd.get(r.commande_id) ?? []) : [];
    // Cartons pour cette ligne = nb de références colis liées à la commande.
    const cartons = Number(refs.length || colis?.cartons || 0);
    totalCartons += cartons;
    totalColis += 1;
    const type = (r.type_livraison ?? "").toLowerCase();
    if (type.includes("expedi") || r.gare_nom) nbExpeditions += 1;
    else nbLivraisons += 1;
    const typeLabel =
      type.includes("expedi") || r.gare_nom
        ? `Expédition${r.gare_nom ? ` — ${r.gare_nom}` : ""}${r.transporteur ? ` (${r.transporteur})` : ""}`
        : "Livraison directe";
    return [
      r.commandes?.reference ?? "—",
      nom,
      colis?.destinataire ?? nom,
      infoCli?.adresse ?? "—",
      r.ville_livraison ?? "—",
      infoCli?.telephone ?? "—",
      typeLabel,
      String(cartons),
      refs.join(", ") || "—",
      STATUT_LIV_LABEL[r.statut ?? ""] ?? r.statut ?? "—",
    ];
  });

  autoTable(doc, {
    head: [
      [
        "Réf commande",
        "Client",
        "Destinataire",
        "Adresse",
        "Ville",
        "Téléphone",
        "Type",
        "Cart.",
        "Références cartons",
        "Statut",
      ],
    ],
    body,
    startY: y,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: PDF_TABLE.headStyles,
    bodyStyles: PDF_TABLE.bodyStyles,
    columnStyles: {
      7: { halign: "right", cellWidth: 10 },
      8: { cellWidth: 38 },
    },

    didDrawPage: () => {
      drawHeader(doc, titre, template);
      drawFooter(doc, `Bon de tournée ${t.reference}`, template);
    },
  });

  // @ts-expect-error lastAutoTable jspdf-autotable
  let afterY: number = (doc.lastAutoTable?.finalY ?? y) + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Récapitulatif", marginX, afterY);
  afterY += 4;
  doc.setFont("helvetica", "normal");
  // Si aucune livraison_commande n'existe (tournée alimentée uniquement par
  // les colis), on recalcule le récap à partir des colis.
  if (list.length === 0 && (colisRows ?? []).length > 0) {
    const colisArr = (colisRows ?? []) as Array<{
      commande_id: string | null;
      nb_cartons: number | null;
      mode_acheminement?: string | null;
    }>;
    // Règle métier : 1 commande = 1 colis (avec N cartons physiques).
    // Chaque ligne de la table `colis` représente un carton.
    totalCartons = colisArr.length;
    totalColis = new Set(colisArr.map((c) => c.commande_id).filter(Boolean)).size;
    const cmdIds = Array.from(
      new Set(colisArr.map((c) => c.commande_id).filter(Boolean) as string[]),
    );
    if (cmdIds.length) {
      const { data: cmds } = await supabase
        .from("commandes")
        .select("commande_id, client_nom")
        .in("commande_id", cmdIds);
      (cmds ?? []).forEach((c) => c.client_nom && clientsSet.add(c.client_nom));
    }
    for (const c of colisArr) {
      const m = (c.mode_acheminement ?? "").toLowerCase();
      if (m.includes("exped") || m.includes("gare")) nbExpeditions += 1;
      else nbLivraisons += 1;
    }
  }
  const recap = [
    `Clients : ${clientsSet.size}`,
    `Livraisons : ${nbLivraisons}`,
    `Expéditions : ${nbExpeditions}`,
    `Colis : ${totalColis}`,
    `Cartons : ${totalCartons}`,
  ].join("   ·   ");
  doc.text(recap, marginX, afterY);
  afterY += 10;

  drawSignatures(doc, afterY, ["Responsable logistique", "Chauffeur / Transporteur"], marginX);

  // La rubrique détaillée « Réf client / Références cartons » a été retirée :
  // toutes ses informations sont désormais présentes dans la table principale
  // ci-dessus (colonne « Références cartons » incluse).


  addPageNumbers(doc);
  return doc.output("blob");
}

/**
 * BON DE SORTIE DE CAISSE — document financier destiné à la Comptabilité
 * pour autoriser et justifier le décaissement des frais d'une tournée.
 */
export async function generateBonSortieCaissePDF(tourneeId: string): Promise<Blob> {
  const { data: t } = await supabase
    .from("tournees")
    .select(
      "tournee_id, reference, date_tournee, responsable_nom, chauffeur_nom, vehicule_id, statut, type_tournee, validation_statut, mode_reglement, validation_at, validation_by, validation_commentaire, ecriture_id, nb_clients, nb_colis, nb_cartons, cout_carburant, cout_peages, cout_repas, cout_manutentions, cout_livraison, cout_expeditions, cout_autres, cout_total",
    )
    .eq("tournee_id", tourneeId)
    .maybeSingle();
  if (!t) throw new Error("Tournée introuvable");
  const vehicule = await fetchVehicule(t.vehicule_id);

  let comptableNom = "—";
  if (t.validation_by) {
    const { data: p } = await supabase
      .from("profiles")
      .select("nom_complet, email")
      .eq("id", t.validation_by)
      .maybeSingle();
    if (p) comptableNom = p.nom_complet || p.email || "—";
  }

  let ecritureRef = "—";
  if (t.ecriture_id) {
    const { data: ec } = await supabase
      .from("ecritures_comptables")
      .select("reference")
      .eq("ecriture_id" as never, t.ecriture_id as never)
      .maybeSingle();
    if (ec && (ec as { reference?: string }).reference)
      ecritureRef = (ec as { reference: string }).reference;
  }

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  await ensurePdfLogo();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginX = 14;
  const template = getActiveTemplate();
  const titre = "BON DE SORTIE DE CAISSE TOURNEE";
  drawHeader(doc, titre, template);
  let y = getPdfChromeBodyTop();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`N° Bon de sortie de caisse : BSC-${t.reference}`, marginX, y);
  y += 6;

  y = drawInfoBlock(
    doc,
    y,
    [
      ["Date", t.date_tournee ?? "—"],
      ["N° tournée", t.reference],
      ["Responsable logistique", t.responsable_nom ?? "—"],
      ["Chauffeur / Transporteur", t.chauffeur_nom ?? "—"],
      ["Véhicule", vehicule],
      ["Objet", "Décaissement des frais de tournée"],
    ],
    marginX,
  );

  const cats: Array<[string, number]> = [
    ["Carburant", Number(t.cout_carburant ?? 0)],
    ["Péages", Number(t.cout_peages ?? 0)],
    ["Repas", Number(t.cout_repas ?? 0)],
    ["Manutentions", Number(t.cout_manutentions ?? 0)],
    ["Frais de livraison", Number(t.cout_livraison ?? 0)],
    ["Frais d'expédition", Number(t.cout_expeditions ?? 0)],
    ["Autres frais", Number(t.cout_autres ?? 0)],
  ];
  const total = Number(t.cout_total ?? cats.reduce((s, [, v]) => s + v, 0));

  autoTable(doc, {
    head: [["Catégorie", "Montant (FCFA)"]],
    body: [
      ...cats.map(([label, v]) => [
        label,
        fmtMontant(v),
      ]),
      [
        { content: "TOTAL GÉNÉRAL", styles: { fontStyle: "bold" as const } },
        {
          content: fmtMontant(total),
          styles: { fontStyle: "bold" as const, halign: "right" as const },
        },
      ],
    ],
    startY: y,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: PDF_TABLE.bodyFontSize, cellPadding: 3 },
    columnStyles: { 1: { halign: "right" } },
    headStyles: PDF_TABLE.headStyles,
    bodyStyles: PDF_TABLE.bodyStyles,
    didDrawPage: () => {
      drawHeader(doc, titre, template);
      drawFooter(doc, `Bon de sortie de caisse ${t.reference}`, template);
    },
  });

  // @ts-expect-error lastAutoTable jspdf-autotable
  let afterY: number = (doc.lastAutoTable?.finalY ?? y) + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Validation comptable", marginX, afterY);
  afterY += 4;
  afterY = drawInfoBlock(
    doc,
    afterY,
    [
      ["Statut", t.validation_statut ?? "En attente"],
      [
        "Date validation",
        t.validation_at ? new Date(t.validation_at).toLocaleDateString("fr-FR") : "—",
      ],
      ["Comptable", comptableNom],
      ["Mode règlement", t.mode_reglement ?? "—"],
      ["Réf. écriture", ecritureRef],
      ["", ""],
    ],
    marginX,
  );

  if (t.validation_commentaire) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Commentaire :", marginX, afterY);
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(t.validation_commentaire, 180);
    doc.text(split, marginX, afterY + 4);
    afterY += 4 + split.length * 4 + 4;
  }

  afterY += 4;
  drawSignatures(
    doc,
    afterY,
    ["Responsable logistique", "Comptable", "Directeur financier", "Bénéficiaire"],
    marginX,
  );

  addPageNumbers(doc);
  return doc.output("blob");
}

/**
 * Alias rétro-compatible. L'ancien « Bon de sortie » (marchandises) faisait
 * doublon avec le Bon de tournée ; on le remplace par le Bon de sortie de
 * caisse pour ne pas casser les appels existants.
 */
export async function generateBonSortiePDF(tourneeId: string): Promise<Blob> {
  return generateBonSortieCaissePDF(tourneeId);
}

/**
 * Alias rétro-compatible pour l'ancien récapitulatif de coûts, désormais
 * fusionné avec le Bon de sortie de caisse.
 */
export async function generateRecapCoutsTourneePDF(tourneeId: string): Promise<Blob> {
  return generateBonSortieCaissePDF(tourneeId);
}

// ---------------------------------------------------------------------------
// Fin du module. Les anciennes fonctions basées sur les templates BL / BT
// (`fabsTemplates`) sont retirées : elles ne correspondaient plus à la
// spécification métier (Bon de tournée = planning, Bon de sortie de caisse =
// décaissement financier).
// ---------------------------------------------------------------------------
/* eslint-disable */
function _legacyRemovedMarker() {
  // no-op : conserve l'ancre pour git blame.
  return null;
}
// eslint-enable
