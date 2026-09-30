
import { BaseDocument, COLORS, MARGINS, PAGE, CONTENT_W, CONTENT_BOTTOM } from "./base-document";
import { formatFCFA } from "@/lib/format";
import tamponUrl from "@/assets/tampon-comptabilite.png";

const ROW_H = 20;
const TAMPON_TITLE_H = 18;
const TAMPON_ZONE_H = 130;

export class StatementDocument extends BaseDocument {
  async drawContent(data: any) {
    let y = PAGE.h - 110;
    
    // Infos Client & Période
    y = await this.drawClientInfo(y, data);
    
    // Tableau des opérations
    const colonnes = [
      { label: "Date", key: "date", width: 58 },
      { label: "Référence", key: "reference", width: 82 },
      { label: "Libellé", key: "libelle", width: 127 },
      { label: "Débit", key: "debit", width: 65 },
      { label: "Paiement", key: "credit", width: 65 },
      { label: "Retour", key: "retour", width: 65 },
      { label: "Solde", key: "solde", width: 65 },
    ];
    
    const lignes = data.lignes.map((l: any) => ({
      date: /^\d{4}-\d{2}-\d{2}/.test(String(l.date ?? ""))
        ? String(l.date).slice(0, 10).split("-").reverse().join("/")
        : l.date,
      reference: l.reference,
      libelle: l.libelle || l.designation || "",
      debit: l.debit || 0,
      // Une ligne n'alimente qu'une seule colonne : les retours vont en RETOUR.
      credit: l.type === "Avoir" ? 0 : l.credit || 0,
      retour: l.type === "Avoir" ? l.credit || 0 : 0,
      solde: l.soldeProgressif || 0,
    }));

    y = this.drawTable(y, colonnes, lignes);
    
    // Récapitulatif + zone COMPTABILITÉ : gardés ensemble sur la même page.
    const rows = this.summaryRows(data);
    const needed = rows.length * ROW_H + 20 + TAMPON_TITLE_H + TAMPON_ZONE_H;
    if (y - needed < CONTENT_BOTTOM) {
      this.addNewPage();
      y = PAGE.h - 110;
    }
    y = this.drawSummary(y, rows);
    await this.drawZoneComptabilite(y);
  }

  async drawClientInfo(y: number, data: any): Promise<number> {
    const boxH = 110;
    const boxW = (CONTENT_W - 15) / 2;
    
    // Bloc Client
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: COLORS.grisClair,
      opacity: 0.5,
    });

    const bleuFabs = COLORS.bleuFabs;
    this.page.drawText("RELEVÉ POUR", { x: MARGINS.x + 10, y: y - 15, size: 7, font: this.fonts.bold, color: bleuFabs });
    this.page.drawText(this.data.client.nom.toUpperCase(), { x: MARGINS.x + 10, y: y - 32, size: 12, font: this.fonts.bold, color: bleuFabs });
    
    const kv = [
      { l: "Ville", v: this.data.client.ville || "—" },
      { l: "Représentant", v: this.data.client.representant || "—" },
      { l: "Téléphone", v: this.data.client.telephone || "—" },
    ];

    kv.forEach((item, i) => {
      const rowY = y - 52 - i * 18;
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: rowY, size: 10, font: this.fonts.regular });
      this.page.drawText(String(item.v), { x: MARGINS.x + 105, y: rowY, size: 11, font: this.fonts.bold });
    });


    // Bloc Période (sans cadre) + QR code à droite
    const perX = MARGINS.x + boxW + 15;
    await this.drawStatementQr(PAGE.w - MARGINS.x - boxH, y - boxH, boxH, data);
    this.page.drawText("PÉRIODE", { x: perX + 10, y: y - 15, size: 7, font: this.fonts.bold, color: COLORS.bleuFabs });
    const periode = data.periodeDebut && data.periodeFin 
      ? `Du ${data.periodeDebut} au ${data.periodeFin}`
      : "Relevé complet";
    this.page.drawText(periode, { x: perX + 10, y: y - 32, size: 9, font: this.fonts.bold });
    
    return y - boxH - 20;
  }

  /** QR dynamique (même outil/couleurs que factures, BC, BL, proformas) ouvrant le relevé de ce client. */
  async drawStatementQr(x: number, yBottom: number, size: number, data: any) {
    try {
      const clientId = data.clientId ?? this.data.client?.id;
      if (!clientId) return;
      const { default: QRCode } = await import("qrcode");
      const { QR_COLOR_OPTS, PUBLIC_VERIFY_BASE_URL } = await import("./qr-logic");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const base = origin && !/localhost|id-preview|lovableproject|sandbox/.test(origin) ? origin : PUBLIC_VERIFY_BASE_URL;
      const target = `${base}/clients/${encodeURIComponent(clientId)}?releve=1`;
      const url = await QRCode.toDataURL(target, { margin: 1, width: 400, errorCorrectionLevel: "M", color: QR_COLOR_OPTS });
      const img = await this.doc.embedPng(url);
      this.page.drawImage(img, { x, y: yBottom, width: size, height: size });
    } catch (e) {
      console.error("QR relevé", e);
    }
  }

  /** Lignes du récapitulatif : les montants à 0 sont omis, le solde toujours affiché. */
  summaryRows(data: any): Array<{ label: string; value: number; total?: boolean }> {
    const totalDebit = Number(data.totalDebit ?? data.lignes.reduce((a: number, l: any) => a + (l.debit || 0), 0));
    const totalPaiement = Number(data.totalPaiement ?? data.lignes
      .filter((l: any) => l.type === "Paiement")
      .reduce((a: number, l: any) => a + (l.credit || 0), 0));
    const totalRetours = Number(data.totalRetours ?? data.lignes
      .filter((l: any) => l.type === "Avoir")
      .reduce((a: number, l: any) => a + (l.credit || 0), 0));
    const solde = Number(
      data.solde ?? Number(data.soldeOuverture ?? 0) + totalDebit - totalPaiement - totalRetours,
    );
    const transport = Number(data.totalTransport ?? 0);
    const rows: Array<{ label: string; value: number; total?: boolean }> = [];
    if (totalDebit !== 0) rows.push({ label: "Total Débit", value: totalDebit });
    if (totalPaiement > 0) rows.push({ label: "Total Paiement", value: totalPaiement });
    if (totalRetours > 0) rows.push({ label: "Total Retours", value: totalRetours });
    // Information seule : déjà comprise dans les factures, jamais ajoutée au solde.
    if (transport > 0) rows.push({ label: "Frais de transport compris dans les factures", value: transport });
    rows.push({
      label: solde >= 0 ? "SOLDE DÉBITEUR (IMPAYÉ)" : "SOLDE CRÉDITEUR",
      value: Math.abs(solde),
      total: true,
    });
    return rows;
  }

  drawSummary(y: number, rows: Array<{ label: string; value: number; total?: boolean }>): number {
    const boxW = 260;
    const x = PAGE.w - MARGINS.x - boxW;
    let curY = y;
    for (const r of rows) {
      const color = r.total ? COLORS.rougeFabs : COLORS.noir;
      const font = r.total ? this.fonts.bold : this.fonts.regular;
      this.page.drawText(r.label, { x: x + 5, y: curY - 13, size: 8, font, color });
      const valText = formatFCFA(r.value);
      const valW = font.widthOfTextAtSize(valText, 9);
      this.page.drawText(valText, { x: PAGE.w - MARGINS.x - valW - 5, y: curY - 13, size: 9, font, color });
      this.page.drawLine({ start: { x, y: curY - 20 }, end: { x: PAGE.w - MARGINS.x, y: curY - 20 }, color: COLORS.grisLigne, thickness: 0.5 });
      curY -= ROW_H;
    }
    return curY - 20;
  }

  /** Véritable tampon, posé directement sur la page (sans titre ni cadre) (proportions conservées). */
  async drawZoneComptabilite(y: number) {
    const boxW = 200;
    const x = PAGE.w - MARGINS.x - boxW;
    const zoneTop = y - TAMPON_TITLE_H;
    const zoneBottom = zoneTop - TAMPON_ZONE_H;
    try {
      const res = await fetch(tamponUrl);
      if (!res.ok) return;
      const img = await this.doc.embedPng(new Uint8Array(await res.arrayBuffer()));
      const pad = 8;
      const scale = Math.min((boxW - pad * 2) / img.width, (TAMPON_ZONE_H - pad * 2) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      this.page.drawImage(img, {
        x: x + (boxW - w) / 2,
        y: zoneBottom + (TAMPON_ZONE_H - h) / 2,
        width: w,
        height: h,
      });
    } catch {
      // Tampon indisponible : la zone réservée reste propre, sans erreur PDF.
    }
  }
}
