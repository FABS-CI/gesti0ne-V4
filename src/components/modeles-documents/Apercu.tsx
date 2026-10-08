import type { PdfTemplate } from "@/lib/pdf/pdfConfig";
import { rgb } from "@/lib/modeles-documents-helpers";

export function Apercu({ t }: { t: PdfTemplate }) {
  const head = rgb(t.tableHeadFill);
  const accent = rgb(t.accent);
  const serif = t.font === "times";
  const headerNode = (() => {
    switch (t.headerVariant) {
      case "classique":
      case "corporate":
        return (
          <div
            className="flex items-start justify-between px-3 py-2"
            style={{ background: rgb(t.headerBg ?? t.tableHeadFill) }}
          >
            <div style={{ color: rgb(t.companyColor) }}>
              <div className="text-xs font-bold leading-tight">EDITIONS FABS-CI</div>
              <div className="text-xs opacity-80">Une innovation pour une école…</div>
            </div>
            <div className="text-xs font-bold" style={{ color: rgb(t.titleColor) }}>
              FACTURE
            </div>
          </div>
        );
      case "moderne":
        return (
          <div
            className="px-3 py-2 text-center"
            style={{ background: rgb(t.headerBg ?? t.tableHeadFill) }}
          >
            <div className="text-xs font-bold" style={{ color: rgb(t.companyColor) }}>
              EDITIONS FABS-CI
            </div>
            <div className="text-xs opacity-80" style={{ color: rgb(t.companyColor) }}>
              Une innovation pour une école…
            </div>
            <div className="text-xs font-bold" style={{ color: rgb(t.titleColor) }}>
              FACTURE
            </div>
          </div>
        );
      case "premium":
        return (
          <div className="px-3 py-2 text-center bg-white">
            <div
              className="text-xs font-bold"
              style={{ color: rgb(t.companyColor), fontFamily: "Georgia, serif" }}
            >
              EDITIONS FABS-CI
            </div>
            <div className="text-xs italic text-muted-foreground">Une innovation…</div>
            <div className="mx-auto my-1 h-[2px] w-8" style={{ background: accent }} />
            <div
              className="text-xs font-bold"
              style={{ color: rgb(t.titleColor), fontFamily: "Georgia, serif" }}
            >
              FACTURE
            </div>
          </div>
        );
      case "administratif":
        return (
          <div className="bg-white px-3 py-2">
            <div className="flex items-start justify-between">
              <div style={{ fontFamily: "Georgia, serif" }}>
                <div className="text-xs font-bold" style={{ color: rgb(t.companyColor) }}>
                  EDITIONS FABS-CI
                </div>
                <div className="text-xs italic text-muted-foreground">Une innovation…</div>
              </div>
              <div className="text-xs font-bold" style={{ color: rgb(t.titleColor) }}>
                FACTURE
              </div>
            </div>
            <div className="mt-1 h-[1px] w-full" style={{ background: rgb(t.companyColor) }} />
          </div>
        );
    }
  })();

  return (
    <div
      className="overflow-hidden rounded-md border bg-white shadow-sm"
      style={{ fontFamily: serif ? "Georgia, serif" : undefined }}
    >
      {headerNode}
      <div className="space-y-1 p-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>N° FA-2026-00042</span>
          <span>Client : Lycée Moderne</span>
        </div>
        <div className="mt-1 overflow-hidden rounded">
          <div
            className="grid grid-cols-4 gap-1 px-1 py-[3px] text-xs font-bold text-white"
            style={{ background: head }}
          >
            <span className="col-span-2">Désignation</span>
            <span className="text-right">PU</span>
            <span className="text-right">Montant</span>
          </div>
          {["Manuel CE1", "Cahier TP", "Guide pédago"].map((d) => (
            <div
              key={d}
              className="grid grid-cols-4 gap-1 border-b px-1 py-[2px] text-xs text-foreground"
            >
              <span className="col-span-2">{d}</span>
              <span className="text-right">2 500</span>
              <span className="text-right">25 000</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <div
            className="rounded px-2 py-[2px] text-xs font-bold"
            style={
              t.totalBoxed ? { border: `1px solid ${accent}`, color: accent } : { color: accent }
            }
          >
            TOTAL TTC : 765 000 FCFA
          </div>
        </div>
      </div>
    </div>
  );
}
