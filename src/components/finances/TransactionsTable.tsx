import { Pencil, Trash2, Wallet } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/rbac/Can";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CATEGORIE_TRANSACTION_LABEL,
  STATUT_TRANSACTION_LABEL,
  TYPE_TRANSACTION_LABEL,
  type Transaction,
} from "@/lib/finances-api";
import { formatFCFA, formatDate } from "@/lib/format";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

type Props = {
  transactions: Transaction[];
  isLoading: boolean;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
};

export function TransactionsTable({ transactions, isLoading, onEdit, onDelete }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                Chargement...
              </TableCell>
            </TableRow>
          ) : transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-6">
                <EmptyState
                  variant="rich"
                  icon={Wallet}
                  title="Aucune transaction enregistrée"
                  description="Les recettes et dépenses de trésorerie apparaîtront ici pour alimenter votre suivi financier."
                  className="border-none"
                />
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((t) => {
              const typeMeta = TYPE_TRANSACTION_LABEL[t.type];
              const statutMeta = STATUT_TRANSACTION_LABEL[t.statut];
              return (
                <TableRow key={t.transaction_id}>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(t.date_transaction)}</TableCell>
                  <TableCell className="font-medium">{t.libelle}</TableCell>
                  <TableCell>{CATEGORIE_TRANSACTION_LABEL[t.categorie] ?? t.categorie}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{ color: typeMeta?.color, borderColor: typeMeta?.color }}
                    >
                      {typeMeta?.label ?? t.type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-right font-semibold"
                    style={{ color: typeMeta?.color }}
                  >
                    {t.type === "depense" ? "-" : "+"}
                    {formatFCFA(Number(t.montant))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{ color: statutMeta?.color, borderColor: statutMeta?.color }}
                    >
                      {statutMeta?.label ?? t.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Can permission="finances.supprimer">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const r = await confirm({
                            title: "Supprimer cette transaction ?",
                            entityLabel: "la transaction",
                            entityName: t.reference ?? undefined,
                          });
                          if (r === false) return;
                          onDelete(t.transaction_id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </Can>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {confirmDialog}
    </div>
  );
}
