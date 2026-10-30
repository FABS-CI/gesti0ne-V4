// Notes 3A, 3C, 3C BIS et 3D : tableaux de mouvements des immobilisations.

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import type { NoteTableau } from "@/lib/etats-financiers/notes-immobilisations";
import { formatFCFA } from "@/lib/format";

/** Vide : montant non disponible dans la comptabilité (≠ zéro). */
const montant = (n: number | null | undefined) => (n == null ? "" : n ? formatFCFA(n, false) : "—");

export function NotesImmobilisations({ tableaux }: { tableaux: NoteTableau[] }) {
  const [numero, setNumero] = useState(tableaux[0]?.numero ?? "");
  const t = tableaux.find((x) => x.numero === numero) ?? tableaux[0];
  if (!t) return null;

  return (
    <div className="space-y-2">
      <Select value={t.numero} onValueChange={setNumero}>
        <SelectTrigger className="w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tableaux.map((x) => (
            <SelectItem key={x.numero} value={x.numero}>
              Note {x.numero} : {x.titre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Card>
        <CardContent className="p-0">
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rubriques</TableHead>
                  {t.colonnes.map((c) => (
                    <TableHead key={c.cle} className="text-right">
                      {c.libelle}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.lignes.map((l, i) => (
                  <TableRow
                    key={`${i}-${l.libelle}`}
                    className={l.niveau === "detail" ? undefined : "bg-muted/50 font-semibold"}
                  >
                    <TableCell>{l.libelle}</TableCell>
                    {t.colonnes.map((c) => (
                      <TableCell key={c.cle} className="text-right tabular-nums">
                        {montant(l.valeurs[c.cle])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
      {t.hypotheses.length > 0 && (
        <ul className="space-y-1 text-xs">
          {t.hypotheses.map((h) => (
            <li key={h} className="flex gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Hypothèse : {h}.
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Calculées depuis les comptes 2x, 28x, 29x, 81x et 82x, avec les mêmes règles que le bilan.
        Case vide : montant non disponible dans la comptabilité, à compléter.
      </p>
    </div>
  );
}
