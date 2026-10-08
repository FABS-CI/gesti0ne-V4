import { COMPANY } from "@/lib/company";

/**
 * En-tête et pied de page uniformisés pour tous les documents imprimables
 * du module Tournées (Bon de tournée, Bon de sortie). Aligné sur la charte
 * documentaire ERP FABS-CI : logo textuel, coordonnées, référence, format A4.
 */
export function BonDocumentHeader({
  title,
  reference,
  date,
}: {
  title: string;
  reference: string;
  date?: string | null;
}) {
  return (
    <div className="flex justify-between items-start mb-6 border-b-2 border-slate-800 pb-4">
      <div>
        <h1 className="ds-page-title">{COMPANY.nom}</h1>
        <p className="text-[11px] text-muted-foreground">{COMPANY.adresse}</p>
        <p className="text-[11px] text-muted-foreground">
          Tél : {COMPANY.telephones.join(" / ")} • {COMPANY.email}
        </p>
        <p className="text-[10px] italic text-muted-foreground mt-0.5">{COMPANY.slogan}</p>
      </div>
      <div className="text-right">
        <h2 className="text-xl font-bold uppercase tracking-wide">{title}</h2>
        <p className="text-sm font-mono">{reference}</p>
        {date && <p className="text-xs">{date}</p>}
      </div>
    </div>
  );
}

export function BonDocumentFooter({ documentType }: { documentType: string }) {
  return (
    <div className="mt-8 pt-3 border-t text-[10px] text-muted-foreground flex justify-between print:fixed print:bottom-4 print:left-8 print:right-8">
      <span>
        {COMPANY.nom} — {COMPANY.adresse}
      </span>
      <span>
        {documentType} · Édité le {new Date().toLocaleDateString("fr-FR")}
      </span>
    </div>
  );
}

/**
 * Wrapper A4 standard : marges d'impression cohérentes entre tous les bons.
 */
export function BonDocumentPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-sm print:p-6 print:max-w-none">
      {children}
    </div>
  );
}
