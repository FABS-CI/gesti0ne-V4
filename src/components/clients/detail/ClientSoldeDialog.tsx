import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatFCFA } from "@/lib/format";
import type { Client, ClientRelations } from "@/lib/clients-api";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client;
  rel: ClientRelations | undefined;
};

function frDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export function ClientSoldeDialog({ open, onOpenChange, client, rel }: Props) {
  const factures = rel?.factures ?? [];
  const commandes = rel?.commandes ?? [];
  const paiements = rel?.paiements ?? [];
  const avoirs = rel?.avoirs ?? [];

  const totalCmd = commandes.reduce((s, c) => s + Number(c.montant_total), 0);
  const totalFact = factures.reduce((s, f) => s + Number(f.montant_total), 0);
  const totalPaye = paiements
    .filter((p) => p.statut === "valide")
    .reduce((s, p) => s + Number(p.montant), 0);
  const paiementsAttente = paiements
    .filter((p) => p.statut !== "valide" && p.statut !== "annule")
    .reduce((s, p) => s + Number(p.montant), 0);
  const totalAvoirs = avoirs.reduce((s, a) => s + Number(a.montant), 0);
  const totalRetours = avoirs
    .filter((a) => a.statut !== "annule")
    .reduce((s, a) => s + Number(a.montant), 0);
  const restantDu = factures.reduce((s, f) => {
    if (f.statut === "annulee" || f.statut === "avoir") return s;
    const solde = Number(f.montant_total) - Number(f.montant_paye);
    return solde > 0 ? s + solde : s;
  }, 0);

  const opsDates = [
    ...factures.map((f) => f.date_facture),
    ...paiements.map((p) => p.date_paiement),
    ...commandes.map((c) => c.date_commande),
  ]
    .filter(Boolean)
    .map((d) => new Date(d).getTime());
  const derniereOp = opsDates.length ? new Date(Math.max(...opsDates)).toISOString() : null;
  const derniereFacture = factures[0]?.date_facture ?? null;
  const dernierPaiement = paiements[0]?.date_paiement ?? null;

  const rows: Array<{ label: string; value: string; accent?: string }> = [
    { label: "Solde actuel", value: formatFCFA(Number(client.solde)), accent: Number(client.solde) > 0 ? "text-destructive" : "text-success" },
    { label: "Total des commandes", value: formatFCFA(totalCmd) },
    { label: "Total facturé", value: formatFCFA(totalFact) },
    { label: "Total payé", value: formatFCFA(totalPaye), accent: "text-success" },
    { label: "Paiements en attente", value: formatFCFA(paiementsAttente), accent: "text-warning" },
    { label: "Avoirs", value: formatFCFA(totalAvoirs) },
    { label: "Retours", value: formatFCFA(totalRetours) },
    { label: "Montant restant dû", value: formatFCFA(restantDu), accent: restantDu > 0 ? "text-destructive" : undefined },
    { label: "Dernière opération", value: frDate(derniereOp) },
    { label: "Dernière facture", value: frDate(derniereFacture) },
    { label: "Dernier paiement", value: frDate(dernierPaiement) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solde du client</DialogTitle>
          <DialogDescription>{client.nom} — {client.reference}</DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-md border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-semibold ${r.accent ?? ""}`}>{r.value}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
