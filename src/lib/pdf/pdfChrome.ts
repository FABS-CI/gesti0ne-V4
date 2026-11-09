import type jsPDF from "jspdf";
import { COMPANY } from "@/lib/company";
import {
  PDF_COLORS,
  PDF_PAGINATION,
  getActiveTemplate,
  type PdfTemplate,
} from "@/lib/pdf/pdfConfig";
import { QR_COLOR_OPTS } from "@/lib/pdf/qr-logic";
import fabsLogoUrl from "@/assets/fabs-logo.png";

let LOGO_DATA_URL: string | null = null;
let LOGO_DIMS: { w: number; h: number } | null = null;
let LOGO_PROMISE: Promise<void> | null = null;

/**
 * Précharge le vrai logo officiel `LOGO BLANC BON BON.png`, mappé sur
 * `src/assets/logo_fabs.png.asset.json`, et le met en cache sous forme de
 * data URL pour jsPDF. À appeler (await) avant chaque génération afin que le
 * logo officiel apparaisse dès la première page.
 */
export function ensurePdfLogo(): Promise<void> {
  if (LOGO_DATA_URL) return Promise.resolve();
  if (LOGO_PROMISE) return LOGO_PROMISE;
  LOGO_PROMISE = (async () => {
    try {
      const res = await fetch(fabsLogoUrl);
      if (!res.ok) throw new Error("Logo officiel PDF indisponible.");
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(blob);
      });
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 1, h: 1 });
        img.src = dataUrl;
      });
      LOGO_DATA_URL = dataUrl;
      LOGO_DIMS = dims;
    } catch (error) {
      LOGO_DATA_URL = null;
      LOGO_DIMS = null;
      LOGO_PROMISE = null;
      throw error instanceof Error ? error : new Error("Logo officiel PDF indisponible.");
    }
  })();
  return LOGO_PROMISE;
}

if (typeof window !== "undefined") {
  ensurePdfLogo().catch(() => undefined);
}

// ----------------------------------------------------------------------------
// QR code cache — généré une fois par référence, partagé entre tous les PDF
// jsPDF (rapports/exports) pour les aligner sur le chrome pdf-lib V10 des
// documents commerciaux (qui contient déjà un QR JSON bas-gauche).
// ----------------------------------------------------------------------------
const QR_CACHE = new Map<string, string>();
let CURRENT_QR_REF: string | null = null;

export async function ensurePdfQr(reference: string): Promise<string> {
  const key = `FABS-CI | ${reference}`;
  const hit = QR_CACHE.get(key);
  if (hit) {
    CURRENT_QR_REF = key;
    return hit;
  }
  const { default: QRCode } = await import("qrcode");
  const dataUrl = await QRCode.toDataURL(key, {
    margin: 0,
    width: 200,
    color: QR_COLOR_OPTS,
  });
  QR_CACHE.set(key, dataUrl);
  CURRENT_QR_REF = key;
  return dataUrl;
}

export function clearPdfQr() {
  CURRENT_QR_REF = null;
}

const MM = 1;
const HEADER = {
  left: 14 * MM,
  right: 14 * MM,
  top: 8.5 * MM,
  logoY: 16.8 * MM,
  logoW: 30 * MM,
  logoH: 17 * MM,
  separatorY: 35.5 * MM,
  bodyTop: 42 * MM,
};

const FOOTER = {
  left: 14 * MM,
  right: 14 * MM,
  lineTopFromBottom: 25 * MM,
  lineBottomFromBottom: 12.7 * MM,
  qrSize: 21 * MM,
  signatureYOffset: 3.4 * MM,
};

const FABS_FOOTER_LINES = [
  "Siège social : Bingerville, Qt N'GOTTO, Immeuble cité Angan A. fils et petits-fils, Rez de chaussée. BP 693 TEL : 2122800995/",
  "+225 0759737123 E-MAIL : edition693fabs@gmail.com",
  "Bingerville .Banques : CORIS BANK : C116 01011 007630824101 34 ; SGBCI : CI008 01123012343259990 95.",
];

/**
 * Dessine uniquement le vrai logo officiel chargé depuis l'asset CDN.
 * Aucun ancien logo/fallback résiduel n'est dessiné.
 */
function drawLogo(doc: jsPDF, x: number, y: number, maxW: number, maxH = maxW): number {
  if (LOGO_DATA_URL && LOGO_DIMS) {
    const ratio = LOGO_DIMS.w / LOGO_DIMS.h;
    let w = maxW;
    let h = maxW / ratio;
    if (h > maxH) {
      h = maxH;
      w = maxH * ratio;
    }
    if (w > maxW) {
      w = maxW;
      h = maxW / ratio;
    }
    const ox = x + (maxW - w) / 2;
    const oy = y + (maxH - h) / 2;
    doc.addImage(LOGO_DATA_URL, "PNG", ox, oy, w, h, undefined, "FAST");
    return w;
  }
  return maxW;
}

function sanitizePdfText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function centerText(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  options: { maxWidth?: number } = {},
) {
  const lines = options.maxWidth ? doc.splitTextToSize(value, options.maxWidth) : [value];
  const lineHeight = 3.3;
  lines.slice(0, 2).forEach((line: string, idx: number) => {
    doc.text(line, x, y + idx * lineHeight, { align: "center" });
  });
}

function formatDateTime() {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return {
    date: `${d}/${m}/${y}`,
    time: `${hh}:${mm}`,
  };
}

/**
 * En-tête commun à TOUS les PDF jsPDF (rapports, exports, journal, dashboard…).
 * Il reprend le modèle officiel FABS : logo à gauche, identité société,
 * date/heure à droite, puis un seul titre centré au-dessus du séparateur.
 */
const HEADER_PAGES = new WeakMap<jsPDF, Set<number>>();

export function drawHeader(
  doc: jsPDF,
  titre: string,
  t: PdfTemplate = getActiveTemplate(),
  options: { titleInBody?: boolean } = {},
) {
  // Plusieurs tableaux peuvent rappeler le chrome sur la même page.
  // Ne jamais superposer une deuxième identité ou un deuxième titre.
  const pageNumber = doc.getCurrentPageInfo().pageNumber;
  const drawnPages = HEADER_PAGES.get(doc) ?? new Set<number>();
  if (drawnPages.has(pageNumber)) return;
  drawnPages.add(pageNumber);
  HEADER_PAGES.set(doc, drawnPages);
  const pageW = doc.internal.pageSize.getWidth();
  const { date, time } = formatDateTime();
  const right = pageW - HEADER.right;
  const logoBoxW = HEADER.logoW;
  const textX = HEADER.left + logoBoxW + 4;
  const titleColor = t.titleColor ?? PDF_COLORS.navy;

  drawLogo(doc, HEADER.left, HEADER.logoY, logoBoxW, HEADER.logoH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.black);
  const isListeProduits = titre.includes("LISTE DES PRODUITS");
  const headerText = isListeProduits
    ? ""
    : sanitizePdfText(COMPANY.nom);
  if (headerText) {
    doc.text(headerText, textX, HEADER.top);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  if (!isListeProduits) {
    doc.text(sanitizePdfText(COMPANY.slogan), textX, HEADER.top + 4.2);
  }

  if (!isListeProduits) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_COLORS.black);
    doc.text(`Adresse :  BP 693`, textX, HEADER.top + 9.8);
    doc.text(`Phone : ${COMPANY.telephones[0]?.replace(/\s/g, "") ?? ""}`, textX, HEADER.top + 14.5);
    doc.text(`Email : ${COMPANY.email}`, textX, HEADER.top + 19.2);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.black);
  doc.text(date, right, HEADER.top, { align: "right" });
  doc.text(time, right, HEADER.top + 5, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...titleColor);
  if (titre && !options.titleInBody) {
    const title = sanitizePdfText(titre);
    const maxWidth = pageW - HEADER.left - HEADER.right;
    while (doc.getTextWidth(title) > maxWidth && doc.getFontSize() > 8) {
      doc.setFontSize(doc.getFontSize() - 0.5);
    }
    doc.text(title, pageW / 2, HEADER.separatorY - 2.5, {
      align: "center",
      maxWidth,
    });
  }

  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.25);
  doc.line(HEADER.left, HEADER.separatorY, right, HEADER.separatorY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.black);
}

export function drawFooter(
  doc: jsPDF,
  mentions = "",
  t: PdfTemplate = getActiveTemplate(),
  opts: {
    hideLogo?: boolean;
    signatureColor?: [number, number, number];
    signatureFontStyle?: "normal" | "bold" | "italic" | "bolditalic";
    lineColor?: [number, number, number];
  } = {},
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const right = pageW - FOOTER.right;
  const lineTop = pageH - FOOTER.lineTopFromBottom;
  const lineBottom = pageH - FOOTER.lineBottomFromBottom;
  const accent = t.accent ?? PDF_COLORS.orange;
  // Charte ERP §21.5 : les deux traits du pied de page sont désormais
  // en bleu marine (navy) sur toutes les éditions FABS-CI, au lieu de
  // l'orange historique. `opts.lineColor` permet une exception ponctuelle.
  // Bleu clair / vif de la charte pour une meilleure lisibilité des bandes.
  const lineColor = opts.lineColor ?? ([37, 99, 235] as [number, number, number]);
  const signature = mentions || "La Comptabilité";

  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.7);
  doc.line(FOOTER.left, lineTop, right, lineTop);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  FABS_FOOTER_LINES.forEach((line, index) => {
    centerText(doc, sanitizePdfText(line), pageW / 2, lineTop + 4 + index * 3.6, {
      maxWidth: pageW - 34,
    });
  });

  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.7);
  doc.line(FOOTER.left, lineBottom, right, lineBottom);

  // Règle ERP §21.3 : aucun QR Code sur les rapports / exports / états.
  // Le QR n'est dessiné que par les documents qui l'exigent (FNE, factures,
  // étiquettes) via leur propre pipeline pdf-lib. On retombe ici sur le logo.
  const qrDataUrl = CURRENT_QR_REF ? QR_CACHE.get(CURRENT_QR_REF) : undefined;
  if (qrDataUrl) {
    doc.addImage(
      qrDataUrl,
      "PNG",
      FOOTER.left,
      lineTop - FOOTER.qrSize - 2.5,
      FOOTER.qrSize,
      FOOTER.qrSize,
      undefined,
      "FAST",
    );
  }
  // Charte ERP §21.4 — le logo n'apparaît qu'une seule fois, dans l'en-tête.
  // Toute présence dans le pied de page est supprimée pour uniformiser
  // l'ensemble des documents FABS-CI. `opts.hideLogo` est conservé pour
  // compatibilité mais n'a plus d'effet ici.
  void opts.hideLogo;
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(9);
  const sigColor = opts.signatureColor ?? accent;
  const sigStyle = opts.signatureFontStyle ?? "bolditalic";
  doc.setFont("helvetica", sigStyle);
  doc.setTextColor(...sigColor);
  doc.text(sanitizePdfText(signature), right, lineTop - FOOTER.signatureYOffset, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.black);
}

export function addPageNumbers(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    const showFooter = count === 1 || i === count;
    if (!showFooter) continue;
    doc.setFontSize(PDF_PAGINATION.fontSize);
    doc.setTextColor(...PDF_PAGINATION.color);
    doc.text(
      PDF_PAGINATION.format(i, count),
      pageW - PDF_PAGINATION.right,
      pageH - PDF_PAGINATION.bottom,
      { align: "right" },
    );
  }
  applyErpChromeRule(doc);
}

/**
 * Règle ERP §22 — En-tête / pied de page conditionnels selon la pagination.
 *
 *  - 1 page  : en-tête + pied.
 *  - Page 1  : en-tête uniquement.
 *  - Pages intermédiaires : ni en-tête ni pied.
 *  - Dernière page : pied uniquement.
 *
 * Applique la règle en masquant (rectangles blancs) les zones à ne pas
 * afficher, après que le générateur a dessiné son chrome sur chaque page.
 * Ne s'applique PAS aux bulletins de paie (générés via `bulletinPaieCI.ts`).
 */
export function applyErpChromeRule(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const count = doc.getNumberOfPages();
  // Header band : couvre l'en-tête (logo + société + séparateur ≈ 40 mm).
  const headerBandH = 40;
  // Footer band : couvre QR + siège + signature + pagination ≈ 55 mm.
  const footerBandH = 55;
  for (let i = 1; i <= count; i++) {
    const showHeader = count === 1 || i === 1;
    const showFooter = count === 1 || i === count;
    doc.setPage(i);
    doc.setFillColor(255, 255, 255);
    if (!showHeader) doc.rect(0, 0, pageW, headerBandH, "F");
    if (!showFooter) doc.rect(0, pageH - footerBandH, pageW, footerBandH, "F");
  }
}

export function getPdfChromeBodyTop() {
  return HEADER.bodyTop;
}

export function getPdfChromeFooterTop(doc: jsPDF) {
  return doc.internal.pageSize.getHeight() - FOOTER.lineTopFromBottom;
}
