import { formatDocumentReference } from "@/lib/document-reference";

import { BaseDocument, BODY, roundedRect, COLORS, MARGINS, PAGE, CONTENT_W, CONTENT_BOTTOM } from "./base-document";
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
      reference: formatDocumentReference(l.reference),
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
    const boxW = (CONTENT_W - 15) / 2;
    // Nom du client : renvoyé à la ligne dans la moitié gauche, jamais sur la zone PÉRIODE.
    const nomMaxW = boxW - 20;
    let nomLignes = this.wrapText(this.data.client.nom.toUpperCase(), nomMaxW, 12, this.fonts.bold);
    let nomSize = 12;
    if (nomLignes.length > 2) {
      nomSize = 10;
      nomLignes = this.wrapText(this.data.client.nom.toUpperCase(), nomMaxW, nomSize, this.fonts.bold);
    }
    nomLignes = nomLignes.slice(0, 3);
    const nomH = nomLignes.length * (nomSize + 3);
    const boxH = Math.max(110, 40 + nomH + 3 * 18 + 10);

    // Bloc Client
    roundedRect(this.page, MARGINS.x, y - boxH, CONTENT_W, boxH, 6, {
      color: BODY.grisClair, borderColor: BODY.bord, borderWidth: 0.6,
    });
    const sepX = MARGINS.x + boxW + 7.5;
    this.page.drawLine({ start: { x: sepX, y: y - 8 }, end: { x: sepX, y: y - boxH + 8 }, color: BODY.bord, thickness: 0.6 });

    this.page.drawText("RELEVÉ POUR", { x: MARGINS.x + 10, y: y - 15, size: 7, font: this.fonts.bold, color: BODY.ardoise });
    nomLignes.forEach((ligne, i) => {
      this.page.drawText(ligne, { x: MARGINS.x + 10, y: y - 32 - i * (nomSize + 3), size: nomSize, font: this.fonts.bold, color: BODY.nuit });
    });

    const kv = [
      { l: "Ville", v: this.data.client.ville || "—" },
      { l: "Représentant", v: this.data.client.representant || "—" },
      { l: "Téléphone", v: this.data.client.telephone || "—" },
    ];

    const kvTop = y - 32 - nomH - 8;
    kv.forEach((item, i) => {
      const rowY = kvTop - i * 18;
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: rowY, size: 10, font: this.fonts.bold, color: BODY.ardoise });
      const valLines = this.wrapText(String(item.v), boxW - 115, 11, this.fonts.bold).slice(0, 1);
      this.page.drawText(valLines[0] ?? "—", { x: MARGINS.x + 105, y: rowY, size: 11, font: this.fonts.bold, color: BODY.nuit });
    });


    // Bloc Période (sans cadre) + QR code à droite
    const perX = MARGINS.x + boxW + 15;
    await this.drawStatementQr(PAGE.w - MARGINS.x - boxH + 8, y - boxH + 8, boxH - 16, data);
    this.page.drawText("PÉRIODE", { x: perX + 10, y: y - 15, size: 7, font: this.fonts.bold, color: BODY.ardoise });
    const periode = data.periodeDebut && data.periodeFin 
      ? `Du ${data.periodeDebut} au ${data.periodeFin}`
      : "Relevé complet";
    this.page.drawText(periode, { x: perX + 10, y: y - 32, size: 9, font: this.fonts.bold, color: BODY.nuit });
    
    return y - boxH - 20;
  }

  /** QR dynamique vers la page publique de vérification du relevé (même système que les factures). */
  async drawStatementQr(x: number, yBottom: number, size: number, data: any) {
    try {
      const { default: QRCode } = await import("qrcode");
      const { QR_COLOR_OPTS, buildQrUrl } = await import("./qr-logic");
      // Même mécanisme que factures / BC / reçus : jeton stable → page publique /verify.
      let target: string | null = data.certification?.verification_url ?? null;
      const code = data.client?.reference ?? data.client?.code;
      if (!target && code) {
        const { ensureVerificationSafe } = await import("@/lib/certification/auto-certify");
        const cert = await ensureVerificationSafe(`REL-${code}`);
        target = cert?.verification_url ?? (cert?.token ? buildQrUrl(cert.token) : null);
      }
      if (!target) return;
      const url = await QRCode.toDataURL(target, { margin: 1, width: 400, errorCorrectionLevel: "M", color: QR_COLOR_OPTS });
      const img = await this.doc.embedPng(url);
      roundedRect(this.page, x - 3, yBottom - 3, size + 6, size + 6, 4, { color: BODY.blanc, borderColor: BODY.bord, borderWidth: 0.6 });
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
    // Modèle F : carte crème, ligne de solde en bandeau orange plein (même hauteur totale).
    const PAD = 4;
    const top = y - 6;
    const boxH = rows.length * ROW_H + PAD * 2;
    roundedRect(this.page, x, top - boxH, boxW, boxH, 6, { color: BODY.creme, borderColor: BODY.bord, borderWidth: 0.6 });
    let curY = top - PAD;
    rows.forEach((r, i) => {
      if (r.total) {
        roundedRect(this.page, x + 6, curY - ROW_H + 1, boxW - 12, ROW_H - 2, 4, { color: BODY.orange });
        this.page.drawText(r.label, { x: x + 12, y: curY - 13, size: 8, font: this.fonts.bold, color: BODY.blanc });
        const valText = formatFCFA(r.value);
        const valW = this.fonts.bold.widthOfTextAtSize(valText, 10);
        this.page.drawText(valText, { x: x + boxW - valW - 12, y: curY - 13.5, size: 10, font: this.fonts.bold, color: BODY.blanc });
      } else {
        this.page.drawText(r.label, { x: x + 8, y: curY - 13, size: 8, font: this.fonts.regular, color: BODY.ardoise });
        const valText = formatFCFA(r.value);
        const valW = this.fonts.bold.widthOfTextAtSize(valText, 9);
        this.page.drawText(valText, { x: x + boxW - valW - 8, y: curY - 13, size: 9, font: this.fonts.bold, color: BODY.nuit });
        const next = rows[i + 1];
        this.page.drawLine({ start: { x: x + 8, y: curY - ROW_H }, end: { x: x + boxW - 8, y: curY - ROW_H }, color: BODY.filetCreme, thickness: next?.total ? 0.6 : 0.4 });
      }
      curY -= ROW_H;
    });
    return curY - PAD - 14;
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
