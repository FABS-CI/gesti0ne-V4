import fabsLogoUrl from "@/assets/fabs-logo.png";
import { supabase } from "@/integrations/supabase/client";
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

function infoRow(label: string, value: string, s: Scale, strong = false): string {
  return `<div style="display:grid;grid-template-columns:${s.labelW} 1fr;gap:2mm;border-bottom:1px solid #ddd;padding:${s.rowPad} 0;align-items:baseline">
    <div style="color:#555;font-size:${s.small}">${esc(label)}</div>
    <div style="font-weight:${strong ? 800 : 700};font-size:${s.base};color:${strong ? BLUE : "#000"};word-break:break-word;overflow-wrap:anywhere">${esc(value)}</div>
  </div>`;
}

type Scale = {
  padding: string;
  logoH: string;
  titleSize: string;
  cartonLabel: string;
  cartonNum: string;
  modeSize: string;
  modePad: string;
  clientSize: string;
  base: string;
  small: string;
  rowPad: string;
  gap: string;
  qr: string;
  produitName: string;
  produitQte: string;
  labelW: string;
  showCover: boolean;
};

const SCALES: Record<LabelMode, Scale> = {
  full: {
    padding: "8mm",
    logoH: "18mm",
    titleSize: "20pt",
    cartonLabel: "13pt",
    cartonNum: "38pt",
    modeSize: "15pt",
    modePad: "4mm",
    clientSize: "20pt",
    base: "12pt",
    small: "10pt",
    rowPad: "1.6mm",
    gap: "5mm",
    qr: "34mm",
    produitName: "12pt",
    produitQte: "15pt",
    labelW: "33mm",
    showCover: true,
  },
  compact: {
    padding: "5mm",
    logoH: "11mm",
    titleSize: "12pt",
    cartonLabel: "8pt",
    cartonNum: "20pt",
    modeSize: "10pt",
    modePad: "1.6mm",
    clientSize: "13pt",
    base: "9pt",
    small: "7.5pt",
    rowPad: "0.7mm",
    gap: "2.5mm",
    qr: "24mm",
    produitName: "9pt",
    produitQte: "10pt",
    labelW: "26mm",
    showCover: false,
  },
};

function labelHtml(
  e: EtiquettePayload,
  qr: string,
  logo: string,
  images: Record<string, string>,
  mode: LabelMode = "full",
): string {
  const s = SCALES[mode];
  const isExpedition = e.mode_acheminement === "expedition";
  const telephone = isExpedition ? e.gare_telephone || e.telephone : e.telephone;
  const modeLabel = e.mode_acheminement === "direct" ? "LIVRAISON DIRECTE" : 
                    e.mode_acheminement === "gare" ? "GARE / TRANSPORTEUR" : 
                    (e.mode_acheminement || "—").toUpperCase();

  const produits = (e.produits ?? [])
    .map((p) => {
      const img =
        s.showCover && p.cover_path && images[p.cover_path]
          ? `<img src="${images[p.cover_path]}" alt="" style="width:20mm;height:26mm;object-fit:contain;border:1px solid #ddd;flex:0 0 auto" />`
          : "";
      return `<div style="display:flex;gap:4mm;align-items:flex-start">
        ${img}
        <div style="flex:1;min-width:0">
          <div style="font-size:${s.produitName};font-weight:700;word-break:break-word;overflow-wrap:anywhere">${esc(p.nom || p.designation || "—")}</div>
          <div style="font-size:${s.produitQte};font-weight:900;margin-top:0.5mm">QUANTITÉ : ${esc(p.quantite)} EXEMPLAIRES</div>
        </div>
      </div>`;
    })
    .join("");

  return `<div class="etiquette-carton etiquette-${mode}" data-colis-id="${esc(e.colis_id ?? "")}" style="width:100%;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:${s.padding};border:1px solid #000;background:#fff;color:#000;display:flex;flex-direction:column;position:relative;box-sizing:border-box;overflow:visible">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:4mm;border-bottom:2px solid #000;padding-bottom:${s.gap};margin-bottom:${s.gap}">
      <img src="${logo}" alt="FABS-CI" style="height:${s.logoH};width:auto" />
      <div style="text-align:center;border:2px solid #000;padding:1mm 4mm;line-height:1.05">
        <div style="font-size:${s.cartonLabel};font-weight:700;letter-spacing:0.12em">CARTON</div>
        <div style="font-size:${s.cartonNum};font-weight:900">${esc(e.numero_carton)} / ${esc(e.nb_cartons)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:${s.titleSize};font-weight:900;letter-spacing:0.08em">ÉTIQUETAGE</div>
        <div style="font-size:${s.small};color:#555">FABS-CI Éditions</div>
      </div>
    </div>

    <div style="background:#1B2A57;color:#fff;padding:${s.modePad};margin-bottom:${s.gap};text-align:center;font-weight:900;font-size:${s.modeSize};-webkit-print-color-adjust:exact;print-color-adjust:exact">
      MODE DE LIVRAISON : ${esc(modeLabel)}
    </div>

    <div style="display:flex;gap:${s.gap};align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="color:#555;font-size:${s.small};letter-spacing:0.1em">CLIENT</div>
        <div style="font-size:${s.clientSize};font-weight:900;line-height:1.1;word-break:break-word;overflow-wrap:anywhere">${esc(e.client ?? "—")}</div>

        <div style="margin-top:${s.gap}">
          <div style="color:#555;font-size:${s.small};letter-spacing:0.1em">DESTINATION</div>
          <div style="font-size:${s.clientSize};font-weight:900;color:${BLUE};text-transform:uppercase;line-height:1.1;word-break:break-word;overflow-wrap:anywhere">${esc(e.ville || "—")}</div>
        </div>

        <div style="margin-top:${s.gap}">
          <div style="color:#555;font-size:${s.small};letter-spacing:0.1em">RESPONSABLE / CONTACT</div>
          <div style="font-weight:800;font-size:${s.base};word-break:break-word;overflow-wrap:anywhere">${esc(e.representant ?? "—")}</div>
          ${telephone ? `<div style="font-weight:800;font-size:${s.base}">${esc(telephone)}</div>` : ""}
        </div>
      </div>

      <div style="flex:0 0 auto;width:${s.qr};text-align:center">
        ${qr ? `<img src="${qr}" alt="QR" style="width:${s.qr};height:${s.qr};display:block" />` : `<div style="width:${s.qr};height:${s.qr};border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:7pt;color:#999">QR CODE</div>`}
      </div>
    </div>

    <div style="margin-top:${s.gap}">
      ${infoRow("N° BL", e.bl ?? "—", s, true)}
      ${infoRow("N° Commande", e.commande ?? "—", s)}
      ${e.colis_id ? infoRow("N° Colisage", e.colis_id.slice(0, 8).toUpperCase(), s) : ""}
    </div>

    <div style="margin-top:${s.gap};flex:1 1 auto;min-height:0">
      <div style="font-size:${s.base};font-weight:700;border-bottom:1.5px solid #000;padding-bottom:1mm;margin-bottom:1.5mm;letter-spacing:0.05em">PRODUITS &amp; QUANTITÉS</div>
      <div style="display:flex;flex-direction:column;gap:${s.gap}">${produits || `<div style="font-size:${s.small};color:#555">—</div>`}</div>
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

  const images: Record<string, string> = {};
  const paths = Array.from(
    new Set(
      etiquettes.flatMap((e) => (e.produits ?? []).map((p) => p.cover_path).filter(Boolean)),
    ),
  ) as string[];
  await Promise.all(
    paths.map(async (path) => {
      try {
        const { data } = supabase.storage.from("produits").getPublicUrl(path);
        if (data?.publicUrl) images[path] = await toDataUrl(data.publicUrl);
      } catch {
        /* image optionnelle */
      }
    }),
  );

  if (etiquettes.length === 1) {
    return `<div class="a4-page single-label-page">${labelHtml(etiquettes[0], qrs[0], logo, images)}</div>`;
  }

  let html = "";
  for (let i = 0; i < etiquettes.length; i += 2) {
    const e1 = etiquettes[i];
    const e2 = etiquettes[i + 1];
    html += `<div class="a4-page double-label-page">
      <div class="label-half">${labelHtml(e1, qrs[i], logo, images)}</div>
      ${e2 ? `<div class="crop-marks-v"></div><div class="cut-icon"></div><div class="label-half">${labelHtml(e2, qrs[i + 1], logo, images)}</div>` : ""}
    </div>`;
  }
  return html;
}
