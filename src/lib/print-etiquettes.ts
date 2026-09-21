import logoUrl from "@/assets/fabs-logo.png";
import { toast } from "sonner";

export type PrintLayout = "a4-portrait-auto";

/**
 * Ouvre une fenêtre d'impression dédiée pour une ou plusieurs étiquettes.
 * La mise en page est optimisée pour A4 Portrait :
 * - 1 étiquette -> 1 page pleine
 * - 2+ étiquettes -> 2 par page (disposition verticale)
 */
export function printEtiquettes(
  html: string,
  title = "Étiquettes colis",
  layout: PrintLayout = "a4-portrait-auto",
  mode: "print" | "preview" = "print",
): Window | null {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) {
    toast.error(
      "Fenêtre bloquée par le navigateur. Autorisez les pop-ups pour ce site puis réessayez.",
      { duration: 6000 },
    );
    return null;
  }

  const styles = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  
  .sheet { display: block; width: 100%; min-height: 297mm; position: relative; }

  /* Conteneur d'une page A4 */
  .a4-page {
    width: 210mm;
    height: 297mm;
    page-break-after: always;
    break-after: page;
    position: relative;
    overflow: hidden;
  }

  /* Cas 1 étiquette par page (Page entière) */
  .single-label-page {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 15mm;
  }
  .single-label-page .etiquette-carton {
    width: 190mm !important;
    height: 270mm !important;
  }

  /* Cas 2 étiquettes par page (Moitié A4) */
  .double-label-page {
    display: flex;
    flex-direction: column;
    height: 297mm;
  }
  .label-half {
    height: 148.5mm;
    width: 210mm;
    padding: 6mm 10mm;
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: center;
    overflow: visible;
  }

  .label-half .etiquette-carton {
    width: 190mm !important;
    height: 100% !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  /* Repères de découpe et ciseaux pour le mode double */
  .crop-marks-v {
    position: absolute;
    top: 148.5mm;
    left: 10mm;
    right: 10mm;
    border-top: 0.5mm dashed #000;
    z-index: 100;
  }
  .cut-icon {
    position: absolute;
    left: 50%;
    top: 148.5mm;
    transform: translate(-50%, -50%);
    background: white;
    padding: 0 10px;
    font-size: 14pt;
    font-weight: bold;
    z-index: 101;
  }
  .cut-icon::after { content: " ✂ DÉCOUPE ✂ "; }

  img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .preview-bar { position: fixed; top: 0; left: 0; right: 0; padding: 8px 12px;
    background: #111827; color: #fff; font-size: 13px; display: flex; gap: 8px;
    align-items: center; z-index: 9999; }
  .preview-bar button { background: #F97316; color: #000; border: 0;
    padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; }
  @media print { .preview-bar { display: none; } }
`;
  const autoPrint =
    mode === "print" ? `setTimeout(function () { window.focus(); window.print(); }, 250);` : "";
  const previewBar =
    mode === "preview"
      ? `<div class="preview-bar"><span>Aperçu — ${title}</span><button onclick="window.print()">Imprimer</button><button onclick="window.close()">Fermer</button></div>`
      : "";
  w.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="icon" href="${logoUrl}" />
<style>${styles}</style>
</head>
<body>
${previewBar}
<div class="sheet layout-${layout}">${html}</div>
<script>
  window.addEventListener('load', function () { ${autoPrint} });
</script>
</body>
</html>`);
  w.document.close();
  return w;
}
