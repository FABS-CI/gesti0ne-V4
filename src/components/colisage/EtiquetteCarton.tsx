import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";
import { QR_COLOR_DARK } from "@/lib/pdf/qr-logic";

export interface EtiquettePayload {
  colis_id?: string;
  /** Référence lisible du colisage (colis.reference) — jamais dérivée du UUID. */
  reference_colis?: string;
  bl: string;
  commande?: string;
  client?: string;
  ville?: string;
  representant?: string;
  telephone?: string;
  numero_carton: number;
  nb_cartons: number;
  mode_acheminement?: string;
  produits: Array<{
    nom: string;
    quantite: number;
    cover_path?: string;
    designation?: string;
  }>;
  gare_telephone?: string;
}

const dash = (v: unknown): string => {
  const t = v == null ? "" : String(v).trim();
  return t && t !== "undefined" && t !== "null" ? t : "—";
};

function Field({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11pt] font-extrabold tracking-wider text-gray-600 uppercase">{label}</div>
      <div className={`leading-tight break-words [overflow-wrap:anywhere] ${className}`}>{value}</div>
    </div>
  );
}

export function EtiquetteCarton({ data }: { data: EtiquettePayload }) {
  const qrUrl = useMemo(() => {
    if (!data.colis_id) return null;
    return `${window.location.origin}/carton/${data.colis_id}`;
  }, [data.colis_id]);

  const modeLabel =
    data.mode_acheminement === "direct"
      ? "Livraison directe"
      : data.mode_acheminement === "gare"
        ? "Gare / Transporteur"
        : dash(data.mode_acheminement);
  const telephone =
    data.mode_acheminement === "expedition" ? data.gare_telephone || data.telephone : data.telephone;

  return (
    <div
      data-colis-id={data.colis_id}
      className="etiquette-carton bg-white text-black flex flex-col gap-4 p-[7mm] border-[2px] border-black h-full relative overflow-hidden"
      style={{ width: "100%", minHeight: "148.5mm", boxSizing: "border-box" }}
    >
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-black pb-3">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="FABS-CI"
            className="h-12 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://gesti0ne.lovable.app/logo.png";
            }}
          />
          <div className="leading-tight">
            <div className="text-[13pt] font-black tracking-widest">ÉTIQUETAGE</div>
            <div className="text-[10pt] text-gray-600">FABS-CI Éditions</div>
          </div>
        </div>
        <div className="text-center border-[3px] border-black px-3 py-1 leading-none">
          <div className="text-[11pt] font-extrabold tracking-[0.15em]">CARTON</div>
          <div className="text-[32pt] font-black whitespace-nowrap">
            {data.numero_carton} / {data.nb_cartons}
          </div>
        </div>
      </div>

      <Field label="Client" value={dash(data.client)} className="text-[30pt] font-black uppercase" />
      <Field label="Destination" value={dash(data.ville)} className="text-[30pt] font-black uppercase text-[#1B2A57]" />
      <div className="min-w-0">
        <div className="text-[11pt] font-extrabold tracking-wider text-gray-600">REPRÉSENTANT / CONTACT</div>
        <div className="text-[22pt] font-extrabold uppercase leading-tight break-words">{dash(data.representant)}</div>
        <div className="text-[22pt] font-extrabold leading-tight whitespace-nowrap">{dash(telephone)}</div>
      </div>

      <div className="flex items-end gap-4 border-t-[3px] border-black pt-3">
        <div className="flex-1 min-w-0 space-y-1">
          <Field label="N° BL" value={dash(data.bl)} className="text-[22pt] font-black text-[#1B2A57]" />
          <Field label="N° Commande" value={dash(data.commande)} className="text-[22pt] font-black" />
          <Field label="N° Colisage" value={dash(data.reference_colis)} className="text-[22pt] font-black" />
        </div>
        <div className="shrink-0 bg-white p-2">
          {qrUrl ? (
            <QRCodeSVG value={qrUrl} size={136} level="M" fgColor={QR_COLOR_DARK} bgColor="#FFFFFF" includeMargin />
          ) : (
            <div className="h-[136px] w-[136px] border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-[8pt] font-bold text-center p-4">
              QR INDISPONIBLE
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-gray-300 pt-1 text-center text-[11pt] font-bold text-gray-600 uppercase">
        Mode de livraison : {modeLabel}
      </div>
    </div>
  );
}
