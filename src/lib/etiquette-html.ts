import fabsLogoUrl from "@/assets/fabs-logo.png";
import type { EtiquettePayload } from "@/components/colisage/EtiquetteCarton";
import { QR_COLOR_OPTS } from "@/lib/pdf/qr-logic";

/**
 * Génération autonome du HTML des étiquettes (indépendante du DOM).
 * Garantit que le contenu réel du carton + le QR code sont présents
 * en aperçu, à l'impression et dans le PDF.
 */

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

function qrUrlFor(e: EtiquettePayload): string {
  const envBase = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, "");
  const origin =
    envBase || (typeof window !== "undefined" ? window.location.origin : "https://gesti0ne.lovable.app");
  return e.colis_id
    ? `${origin}/carton/${e.colis_id}`
    : JSON.stringify({
        bl: e.bl,
        commande: e.commande,
        carton: `${e.numero_carton}/${e.nb_cartons}`,
      });
}

/** Bleu électrique FABS-CI — teinte unique, identique à celle des QR codes. */
const BLUE = QR_COLOR_OPTS.dark;

export type LabelMode = "full" | "compact";

const dash = (v: unknown): string => {
  const t = v == null ? "" : String(v).trim();
  return t && t !== "undefined" && t !== "null" ? t : "—";
};

type Scale = {
  padding: string;
  logoH: string;
  titleSize: string;
  cartonLabel: string;
  cartonNum: string;
  modeSize: string;
  modePad: string;
  label: string;
  clientSize: string;
  contactSize: string;
  refSize: string;
  gap: string;
  qr: string;
};

/**
 * Étiquette lisible de loin : le mode compact (2 par A4) reste compact
 * géométriquement mais pas typographiquement.
 */
export const SCALES: Record<LabelMode, Scale> = {
  full: {
    padding: "7mm",
    logoH: "14mm",
    titleSize: "13pt",
    cartonLabel: "11pt",
    cartonNum: "32pt",
    modeSize: "24pt",
    modePad: "2.5mm",
    label: "11pt",
    clientSize: "30pt",
    contactSize: "22pt",
    refSize: "20pt",
    gap: "4mm",
    qr: "36mm",
  },
  compact: {
    padding: "4.5mm",
    logoH: "9mm",
    titleSize: "10pt",
    cartonLabel: "9pt",
    cartonNum: "24pt",
    modeSize: "18pt",
    modePad: "1.2mm",
    label: "10pt",
    clientSize: "24pt",
    contactSize: "18pt",
    refSize: "14pt",
    gap: "2mm",
    qr: "28mm",
  },
};

const WRAP = "word-break:break-word;overflow-wrap:anywhere;white-space:normal";

function field(label: string, value: string, s: Scale, size: string, weight: number, color = "#000", upper = false): string {
  return `<div style="min-width:0">
    <div style="color:#444;font-size:${s.label};font-weight:800;letter-spacing:0.08em">${esc(label)}</div>
    <div style="font-size:${size};font-weight:${weight};line-height:1.08;color:${color};${upper ? "text-transform:uppercase;" : ""}${WRAP}">${esc(value)}</div>
  </div>`;
}

export function labelHtml(e: EtiquettePayload, qr: string, logo: string, mode: LabelMode = "full"): string {
  const s = SCALES[mode];
  const isExpedition = e.mode_acheminement === "expedition";
  const telephone = isExpedition ? e.gare_telephone || e.telephone : e.telephone;
  const modeLabel =
    e.mode_acheminement === "direct"
      ? "LIVRAISON DIRECTE"
      : e.mode_acheminement === "gare"
        ? "GARE / TRANSPORTEUR"
        : dash(e.mode_acheminement).toUpperCase();
  const tel = dash(telephone);

  const cell = (label: string, value: string, size: string, weight: number, color = "#000", upper = false, nowrap = false) =>
    `<div style="min-width:0">
      <div style="color:#444;font-size:${s.label};font-weight:800;letter-spacing:0.08em">${esc(label)}</div>
      <div style="font-size:${size};font-weight:${weight};line-height:1.08;color:${color};${upper ? "text-transform:uppercase;" : ""}${nowrap ? "white-space:nowrap" : WRAP}">${esc(value)}</div>
    </div>`;
  const row2 = (a: string, b: string) =>
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4mm;border-top:2px solid #000;padding-top:${s.gap}">${a}${b}</div>`;

  return `<div class="etiquette-carton etiquette-${mode}" data-colis-id="${esc(e.colis_id ?? "")}" style="width:100%;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:${s.padding};border:1px solid #000;background:#fff;color:#000;display:flex;flex-direction:column;gap:${s.gap};position:relative;box-sizing:border-box;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:3mm">
      <div style="display:flex;align-items:center;gap:2mm">
        <img src="${logo}" alt="FABS-CI" style="height:${s.logoH};width:auto" />
        <div style="line-height:1.1">
          <div style="font-size:${s.titleSize};font-weight:900;letter-spacing:0.08em">ÉTIQUETAGE</div>
          <div style="font-size:${s.label};color:#444">FABS-CI Éditions</div>
        </div>
      </div>
      <div style="text-align:center;border:2px solid #000;padding:0.5mm 3mm;line-height:1.02">
        <div style="font-size:${s.cartonLabel};font-weight:800;letter-spacing:0.12em">CARTON</div>
        <div style="font-size:${s.cartonNum};font-weight:900;white-space:nowrap">${esc(e.numero_carton)} / ${esc(e.nb_cartons)}</div>
      </div>
    </div>

    ${row2(cell("CLIENT", dash(e.client), s.clientSize, 900, "#000", true), cell("DESTINATION", dash(e.ville), s.clientSize, 900, BLUE, true))}
    ${row2(cell("REPRÉSENTANT", dash(e.representant), s.contactSize, 800, "#000", true), cell("CONTACT", tel, s.contactSize, 800, "#000", false, true))}

    <div style="border:2.5px solid #000;background:#000;color:#fff;text-align:center;padding:${s.modePad} 2mm;font-size:${s.modeSize};font-weight:900;letter-spacing:0.04em;${WRAP}">
      MODE DE LIVRAISON : ${esc(modeLabel)}
    </div>

    <div style="display:flex;gap:${s.gap};align-items:center">
      <div style="flex:1;min-width:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:2px solid #000">
        <div style="padding:1.5mm;border-right:1.5px solid #000">${cell("N° BL", dash(e.bl), s.refSize, 900, BLUE)}</div>
        <div style="padding:1.5mm;border-right:1.5px solid #000">${cell("N° COMMANDE", dash(e.commande), s.refSize, 900)}</div>
        <div style="padding:1.5mm">${cell("N° COLISAGE", dash(e.reference_colis), s.refSize, 900)}</div>
      </div>
      <div style="flex:0 0 auto;width:${s.qr};background:#fff">
        ${qr ? `<img src="${qr}" alt="QR" style="width:${s.qr};height:${s.qr};display:block" />` : `<div style="width:${s.qr};height:${s.qr};border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:7pt;color:#999">QR CODE</div>`}
      </div>
    </div>
  </div>`;
}

/**
 * Construit le HTML complet (pagination A4) pour un ensemble d'étiquettes.
 */
export async function buildEtiquettesPrintHtml(etiquettes: EtiquettePayload[]): Promise<string> {
  if (!etiquettes.length) return "";

  const { default: QRCode } = await import("qrcode");

  const logo = await toDataUrl(fabsLogoUrl).catch(() => fabsLogoUrl);

  const qrs = await Promise.all(
    etiquettes.map((e) =>
      QRCode.toDataURL(qrUrlFor(e), {
        margin: 1,
        width: 300,
        errorCorrectionLevel: "M",
        color: QR_COLOR_OPTS,
      }).catch(
        () => "",
      ),
    ),
  );

  if (etiquettes.length === 1) {
    return `<div class="a4-page single-label-page">${labelHtml(etiquettes[0], qrs[0], logo, "full")}</div>`;
  }

  let html = "";
  for (let i = 0; i < etiquettes.length; i += 2) {
    const e1 = etiquettes[i];
    const e2 = etiquettes[i + 1];
    html += `<div class="a4-page double-label-page">
      <div class="label-half">${labelHtml(e1, qrs[i], logo, "compact")}</div>
      ${e2 ? `<div class="crop-marks-v"></div><div class="cut-icon"></div><div class="label-half">${labelHtml(e2, qrs[i + 1], logo, "compact")}</div>` : ""}
    </div>`;
  }
  return html;
}
