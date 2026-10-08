import { formatFCFA } from "@/lib/format";

export type CommandeTotaux = {
  brut: number;
  remisesLignes: number;
  htNet: number;
  remiseGlobaleMontant: number;
  htApresRG: number;
  tva: number;
  ttc: number;
};

export function InfoCell({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`truncate text-sm font-medium ${emphasis ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs sm:text-sm">{label}</span>
      <span className="font-medium text-xs sm:text-sm text-right">{value}</span>
    </div>
  );
}

export function SummaryCard({
  totaux,
  remiseGlobalePct,
  totalArticles,
  totalQuantite,
  fraisTransport = 0,
  typeFraisTransport = null,
}: {
  fraisTransport?: number;
  typeFraisTransport?: "livraison" | "expedition" | null;
  totaux: CommandeTotaux;
  tauxTva: number;
  remiseGlobalePct: number;
  totalArticles: number;
  totalQuantite: number;
}) {
  const totalRemises = totaux.remisesLignes + totaux.remiseGlobaleMontant;
  return (
    <div className="rounded-md border bg-card p-4 space-y-2 text-sm shadow-sm">
      <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">Récapitulatif</h3>
      <Row label="Nombre d'articles" value={String(totalArticles)} />
      <Row label="Quantité totale" value={String(totalQuantite)} />
      <div className="border-t my-2" />
      <Row label="Montant brut" value={formatFCFA(totaux.brut)} />
      <Row label="Remises lignes" value={`- ${formatFCFA(totaux.remisesLignes)}`} />
      <Row
        label={`Remise globale (${remiseGlobalePct}%)`}
        value={`- ${formatFCFA(totaux.remiseGlobaleMontant)}`}
      />
      <Row label="Total remises" value={`- ${formatFCFA(totalRemises)}`} />
      <div className="border-t my-2" />
      <Row label="Total Net HT" value={formatFCFA(totaux.htApresRG)} />
      {totaux.tva > 0 && <Row label="TVA" value={formatFCFA(totaux.tva)} />}
      {typeFraisTransport && (
        <Row
          label={typeFraisTransport === "expedition" ? "Frais d'expédition" : "Frais de livraison"}
          value={formatFCFA(fraisTransport)}
        />
      )}
      <div className="flex justify-between border-t pt-2 text-base font-bold">
        <span>Total à payer</span>
        <span>{formatFCFA(totaux.ttc + (typeFraisTransport ? fraisTransport : 0))}</span>
      </div>
    </div>
  );
}
