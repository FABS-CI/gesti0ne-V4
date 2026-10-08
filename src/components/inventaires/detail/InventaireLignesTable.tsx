import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFCFA } from "@/lib/format";
import type { InventaireLigne } from "@/lib/inventaires-api";

type Live = { ligne: InventaireLigne; compte: number; ecart: number };

type Props = {
  ecartsLive: Live[];
  editable: boolean;
  obs: Record<string, string>;
  onCompte: (id: string, v: number) => void;
  onObs: (id: string, v: string) => void;
};

export function InventaireLignesTable({ ecartsLive, editable, obs, onCompte, onObs }: Props) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead className="text-right w-24">Théorique</TableHead>
            <TableHead className="text-right w-28">Compté</TableHead>
            <TableHead className="text-right w-24">Écart</TableHead>
            <TableHead className="text-right w-32">Val. unitaire</TableHead>
            <TableHead className="text-right w-32">Valeur vente</TableHead>
            <TableHead className="w-48">Observation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ecartsLive.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Aucune ligne
              </TableCell>
            </TableRow>
          ) : (
            ecartsLive.map(({ ligne, compte, ecart }) => (
              <TableRow key={ligne.ligne_id}>
                <TableCell className="font-mono text-xs select-all" title="Référence produit">
                  {ligne.reference_produit ?? "—"}
                </TableCell>
                <TableCell>{ligne.designation}</TableCell>
                <TableCell className="text-right font-medium">{ligne.stock_theorique}</TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      value={compte}
                      onChange={(e) => onCompte(ligne.ligne_id, Number(e.target.value) || 0)}
                      className="h-8 text-right"
                    />
                  ) : (
                    <span className="font-medium">{compte}</span>
                  )}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    ecart > 0
                      ? "text-success"
                      : ecart < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {ecart > 0 ? `+${ecart}` : ecart}
                </TableCell>
                <TableCell className="text-right">
                  {formatFCFA(Number(ligne.valeur_unitaire))}
                </TableCell>
                <TableCell className="text-right font-medium text-success">
                  {formatFCFA(compte * Number(ligne.valeur_unitaire))}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Input
                      value={obs[ligne.ligne_id] ?? ""}
                      onChange={(e) => onObs(ligne.ligne_id, e.target.value)}
                      className="h-8"
                      placeholder="—"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {obs[ligne.ligne_id] || "—"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
