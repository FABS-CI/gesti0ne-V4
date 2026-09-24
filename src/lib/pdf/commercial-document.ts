
import { BaseDocument, COLORS, MARGINS, PAGE, CONTENT_W, type DocLigne } from "./base-document";
import { formatFCFA } from "@/lib/format";
import { rgb, degrees } from "pdf-lib";
import tamponUrl from "@/assets/tampon-comptabilite.png";


export class CommercialDocument extends BaseDocument {
  discountMode: 'A' | 'B' | 'NONE' = 'NONE';

  setDiscountMode(mode: 'A' | 'B' | 'NONE') {
    this.discountMode = mode;
  }

  // Surcharge du Header pour ajouter le bandeau orange sous le titre
  drawHeader() {
    super.drawHeader();
    
    const yTop = PAGE.h - 25;
    const sepY = yTop - 70;
    
    // Bandeau orange sous l'en-tête (Spécificité FABS-CI)
    this.page.drawLine({
      start: { x: MARGINS.x, y: sepY },
      end: { x: PAGE.w - MARGINS.x, y: sepY },
      thickness: 0.8,
      color: COLORS.bleuElectrique,
    });
  }

  async drawContent() {
    let y = PAGE.h - 110;
    
    // Infos Client & QR
    y = await this.drawClientAndQr(y);
    
    // Tableau
    const isBL = this.data.type === 'Bon de Livraison';
    // Répartition A4 : N° 5% · Code 13% · Désignation 42% · Qté 8% · P.U. 10% · Remise 10% · Montant 12%
    const pct = (p: number) => Math.round(CONTENT_W * p) / 100;
    const avecRemise = !isBL && this.discountMode === 'A';
    const designationW = isBL
      ? CONTENT_W - pct(5) - pct(13) - pct(8)
      : avecRemise
        ? pct(42)
        : pct(52);
    const colonnes = [
      { label: "N°", key: "num", width: pct(5) },
      { label: "Code", key: "code", width: pct(13) },
      { label: "Désignation", key: "designation", width: designationW },
      { label: "Qté", key: "qte", width: pct(8) },
    ];

    if (!isBL) {
      colonnes.push({ label: "P.U.", key: "pu", width: pct(10) });
      if (avecRemise) {
        colonnes.push({ label: "Remise (%)", key: "remisePct", width: pct(10) });
      }
      // Le montant prend le reste exact de l'espace disponible (CONTENT_W)
      const currentWidth = colonnes.reduce((acc, c) => acc + c.width, 0);
      colonnes.push({ label: "Montant", key: "total", width: CONTENT_W - currentWidth });
    }
    
    // Conversion des lignes
    const lignes = (this.data as any).lignes?.map((l: any, i: number) => ({
      num: i + 1,
      code: l.codeArticle ?? l.code ?? "",
      designation: l.designation ?? l.reference ?? "",
      qte: l.qte ?? 0,
      pu: l.prixUnitaire ?? l.pu ?? 0,
      remisePct: l.remisePct ?? 0,
      total: l.montant ?? l.total ?? 0,
    })) || [];

    // Frais de transport : ligne d'affichage uniquement (aucun produit en base,
    // aucun impact stock ni statistiques produits).
    const fraisTransport = Number(this.totals.frais ?? 0);
    if (fraisTransport > 0 && this.totals.fraisLabel) {
      lignes.push({
        num: lignes.length + 1,
        code: "",
        designation: this.totals.fraisLabel,
        qte: 1,
        pu: fraisTransport,
        remisePct: 0,
        total: fraisTransport,
      });
    }


    y = this.drawTable(y, colonnes, lignes);
    
    // Si des remises globales existent, on les affiche en rouge dans le tableau de totaux
    // (Déjà géré dans base-document.ts par la recherche du mot 'remise' dans le label)
    
    // Vérifier si les totaux tiennent sur la page
    if (y < 200) {
      this.addNewPage();
      y = PAGE.h - 110;
    }
    
    // Totaux - Uniquement si ce n'est pas un BL
    if (!isBL) {
      y = this.drawTotals(y);
    }
    
    // Notes / Observations
    y = this.drawNotes(y);
    
    // Montant impayé retiré à la demande de l'utilisateur
    // if (this.data.type === 'Facture' && (this.data as any).soldeDu > 0) {
    //   y = this.drawImpaye(y, (this.data as any).soldeDu);
    // }
    
    // Signatures
    await this.drawSignatures(y);
  }


  drawNotes(y: number): number {
    return super.drawNotes(y);
  }

  drawImpaye(y: number, montant: number): number {
    const boxW = 200;
    const x = PAGE.w - MARGINS.x - boxW;
    
    this.page.drawRectangle({
      x,
      y: y - 25,
      width: boxW,
      height: 25,
      color: COLORS.grisClair,
      borderColor: COLORS.rougeFabs,
      borderWidth: 1,
    });
    
    this.page.drawText("TOTAL IMPAYÉ (FCFA)", {
      x: x + 5,
      y: y - 18,
      size: 9,
      font: this.fonts.bold,
      color: COLORS.rougeFabs,
    });
    
    const val = formatFCFA(montant);
    const valW = this.fonts.bold.widthOfTextAtSize(val, 10);
    this.page.drawText(val, {
      x: PAGE.w - MARGINS.x - valW - 5,
      y: y - 18,
      size: 10,
      font: this.fonts.bold,
      color: COLORS.rougeFabs,
    });
    
    return y - 35;
  }

  async drawSignatures(y: number) {
    const boxW = (CONTENT_W - 20) / 2;
    const boxH = 60;
    // Continuité visuelle TOTAL → MONTANT EN LETTRES → TAMPON (pas de grand vide)
    const curY = Math.max(y - 28, 150);
    
    // Zone signatures conditionnelle
    if (this.data.type === 'Bon de Livraison') {
      // Signature 1 : Le Livreur
      this.page.drawRectangle({
        x: MARGINS.x,
        y: curY - boxH,
        width: boxW,
        height: boxH,
        borderColor: COLORS.bleuElectrique,
        borderWidth: 0.8,
      });
      this.page.drawText("LE LIVREUR", { x: MARGINS.x + 5, y: curY - 15, size: 8, font: this.fonts.bold });
      this.page.drawText("Nom : ....................................", { x: MARGINS.x + 5, y: curY - 30, size: 7, font: this.fonts.regular });
      this.page.drawText("Signature :", { x: MARGINS.x + 5, y: curY - 50, size: 7, font: this.fonts.italic });

      // Signature 2 : Le Client
      this.page.drawRectangle({
        x: PAGE.w - MARGINS.x - boxW,
        y: curY - boxH,
        width: boxW,
        height: boxH,
        borderColor: COLORS.bleuElectrique,
        borderWidth: 0.8,
      });
      this.page.drawText("RÉCEPTION CLIENT", { x: PAGE.w - MARGINS.x - boxW + 5, y: curY - 15, size: 8, font: this.fonts.bold });
      this.page.drawText("Nom : ....................................", { x: PAGE.w - MARGINS.x - boxW + 5, y: curY - 30, size: 7, font: this.fonts.regular });
      this.page.drawText("Signature & Cachet :", { x: PAGE.w - MARGINS.x - boxW + 5, y: curY - 50, size: 7, font: this.fonts.italic });
    } else if (
      this.data.type === 'Facture' ||
      this.data.type === 'Proforma' ||
      this.data.type === 'Commande'
    ) {
      // Documents de vente validés : véritable cachet de la comptabilité.
      await this.drawTamponComptabilite(curY);
    } else if (this.data.type === 'Bon de Réception') {
      // Bloc signature classique (sans tampon)
      this.page.drawRectangle({
        x: PAGE.w - MARGINS.x - boxW,
        y: curY - boxH,
        width: boxW,
        height: boxH,
        borderColor: COLORS.bleuElectrique,
        borderWidth: 0.8,
      });
      this.page.drawText("LA COMPTABILITÉ", { x: PAGE.w - MARGINS.x - boxW + 5, y: curY - 15, size: 8, font: this.fonts.bold });
    }
  }

  /** Véritable cachet haute définition des documents de vente. */
  async drawTamponComptabilite(curY: number) {
    const size = 125;
    const x = PAGE.w - MARGINS.x - size - 10;
    // Le cachet reste dans la zone de validation et au-dessus du pied de page.
    const yBottom = Math.max(curY - size + 10, 78);
    try {
      const res = await fetch(tamponUrl);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const img = await this.doc.embedPng(bytes);
      this.page.drawImage(img, {
        x,
        y: yBottom,
        width: size,
        height: size,
        opacity: 0.92,
        rotate: degrees(-4),
      });
    } catch {
      // Aucun ancien bloc texte ne doit réapparaître si l'image est indisponible.
    }
  }
}

