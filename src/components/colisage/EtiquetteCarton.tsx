import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";
import { QR_COLOR_DARK } from "@/lib/pdf/qr-logic";

export interface EtiquettePayload {
  colis_id?: string;
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

export function EtiquetteCarton({ data }: { data: EtiquettePayload }) {
  // Memoize QR URL
  const qrUrl = useMemo(() => {
    if (!data.colis_id) return null;
    return `${window.location.origin}/carton/${data.colis_id}`;
  }, [data.colis_id]);

  const modeLabel = data.mode_acheminement === "direct" ? "Livraison Directe" : 
                    data.mode_acheminement === "gare" ? "Gare / Transporteur" : 
                    data.mode_acheminement || "—";

  return (
    <div 
      data-colis-id={data.colis_id}
      className="etiquette-carton bg-white text-black flex flex-col p-[8mm] border-[2px] border-black h-full shadow-inner relative overflow-hidden"
      style={{ width: '100%', minHeight: '148.5mm', boxSizing: 'border-box' }}
    >
      {/* Header avec Logo */}
      <div className="flex items-center justify-between border-b-[3px] border-black pb-4 mb-6">
        <img 
          src="/logo.png" 
          alt="FABS-CI" 
          className="h-16 w-auto object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://gesti0ne.lovable.app/logo.png";
          }}
        />
        <div className="text-right">
          <div className="text-[20pt] font-[900] tracking-widest leading-none">ÉTIQUETAGE</div>
          <div className="text-[10pt] text-gray-600 mt-1 font-bold">Fiche carton — FABS-CI Éditions</div>
        </div>
      </div>

      {/* Numéro de Carton */}
      <div className="text-center border-[3px] border-black p-4 mb-6 bg-gray-50/50">
        <div className="text-[14pt] font-black tracking-[0.2em] mb-1">CARTON</div>
        <div className="text-[48pt] font-[900] leading-none">
          {data.numero_carton} <span className="text-gray-400 text-[30pt]">/</span> {data.nb_cartons}
        </div>
      </div>

      {/* Informations Livraison */}
      <div className="text-[12pt] space-y-4">
        <div className="bg-[#1B2A57] text-white p-4 text-center font-black text-[16pt] uppercase tracking-wide">
          MODE : {modeLabel}
        </div>
        
        <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2 items-end">
          <div className="text-gray-500 text-[10pt] uppercase font-bold">N° BL</div>
          <div className="col-span-2 text-[14pt] font-black">{data.bl}</div>
        </div>

        {data.colis_id && (
          <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2 items-end">
            <div className="text-gray-500 text-[10pt] uppercase font-bold">ID Colis</div>
            <div className="col-span-2 font-mono text-[11pt] font-bold">{data.colis_id.slice(0, 8).toUpperCase()}</div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2 items-end">
          <div className="text-gray-500 text-[10pt] uppercase font-bold">Client</div>
          <div className="col-span-2 text-[13pt] font-black uppercase leading-tight">{data.client || "—"}</div>
        </div>

        <div className="border-b border-gray-200 pb-2">
          <div className="text-gray-500 text-[10pt] uppercase font-bold mb-1">Responsable / Contact</div>
          <div className="flex justify-between items-baseline">
            <span className="text-[13pt] font-black uppercase">{data.representant || "—"}</span>
            <span className="text-[12pt] font-bold text-[#1B2A57]">{data.telephone || ""}</span>
          </div>
          <div className="mt-1 text-[13pt] font-black text-primary uppercase">{data.ville || "—"}</div>
        </div>
      </div>

      {/* Liste des produits */}
      <div className="mt-6 flex-1 min-h-0 overflow-hidden">
        <div className="text-[11pt] font-black border-b-2 border-black pb-1 mb-3 uppercase tracking-wider">
          Contenu du carton
        </div>
        <div className="space-y-2">
          {data.produits.map((p, i) => (
            <div key={i} className="flex justify-between items-center text-[11pt] border-b border-gray-100 py-1">
              <span className="font-bold truncate pr-4">{p.nom}</span>
              <span className="font-black px-3 py-1 bg-gray-100 rounded text-[12pt]">x {p.quantite}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QR Code et Footer */}
      <div className="mt-auto pt-6 flex justify-center items-center">
        {qrUrl ? (
          <div className="p-2 border-2 border-gray-100 rounded-xl bg-white shadow-sm">
            <QRCodeSVG 
              value={qrUrl} 
              size={120} 
              level="H"
              fgColor={QR_COLOR_DARK}
              bgColor="#FFFFFF"
              includeMargin={false}
            />
          </div>
        ) : (
          <div className="h-[120px] w-[120px] border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300 text-[8pt] font-bold text-center p-4">
            SCAN TRACKING INDISPONIBLE
          </div>
        )}
      </div>
    </div>
  );
}