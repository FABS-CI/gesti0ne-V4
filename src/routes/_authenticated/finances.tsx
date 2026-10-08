import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  CATEGORIE_TRANSACTION_LABEL,
  MODE_PAIEMENT_LABEL,
  STATUT_TRANSACTION_LABEL,
  TYPE_TRANSACTION_LABEL,
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  type Transaction,
  type TransactionInput,
} from "@/lib/finances-api";
import { invalidateTransaction } from "@/lib/cache-invalidation";

import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancesKpis } from "@/components/finances/FinancesKpis";
import { TransactionsTable } from "@/components/finances/TransactionsTable";
import { TransactionFormDialog } from "@/components/finances/TransactionFormDialog";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/finances")({
  component: FinancesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const emptyForm: TransactionInput = {
  type: "recette",
  categorie: "vente",
  libelle: "",
  montant: 0,
  mode_paiement: "especes",
  statut: "valide",
  date_transaction: new Date().toISOString().slice(0, 10),
  notes: "",
};

function FinancesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const q = useDebouncedValue(search, 300);
  const exerciceId = useExerciceConsulteId();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionInput>(emptyForm);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", exerciceId, q, typeFilter],
    enabled: !!exerciceId,
    queryFn: () => listTransactions(q, typeFilter === "all" ? undefined : typeFilter, exerciceId),
  });

  const totals = useMemo(() => {
    let recettes = 0;
    let depenses = 0;
    for (const t of transactions) {
      if (t.statut === "annule") continue;
      if (t.type === "recette") recettes += Number(t.montant);
      else depenses += Number(t.montant);
    }
    return { recettes, depenses, solde: recettes - depenses };
  }, [transactions]);

  const saveMutation = useMutation({
    mutationFn: (input: TransactionInput) =>
      editing ? updateTransaction(editing.transaction_id, input) : createTransaction(input),
    onSuccess: () => {
      invalidateTransaction(queryClient);
      toast.success(editing ? "Transaction modifiée" : "Transaction enregistrée");
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      invalidateTransaction(queryClient);
      toast.success("Transaction supprimée");
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setForm({
      type: t.type,
      categorie: t.categorie,
      libelle: t.libelle,
      montant: Number(t.montant),
      mode_paiement: t.mode_paiement,
      statut: t.statut,
      date_transaction: t.date_transaction,
      notes: t.notes ?? "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.libelle.trim()) {
      toast.error("Le libellé est requis");
      return;
    }
    saveMutation.mutate(form);
  }

  function handleExport() {
    exportCsv(
      "transactions.csv",
      ["Référence", "Date", "Type", "Catégorie", "Libellé", "Montant", "Mode", "Statut"],
      transactions.map((t) => [
        t.reference,
        t.date_transaction,
        TYPE_TRANSACTION_LABEL[t.type]?.label ?? t.type,
        CATEGORIE_TRANSACTION_LABEL[t.categorie] ?? t.categorie,
        t.libelle,
        String(t.montant),
        MODE_PAIEMENT_LABEL[t.mode_paiement] ?? t.mode_paiement,
        STATUT_TRANSACTION_LABEL[t.statut]?.label ?? t.statut,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Finances
          </h1>
          <p className="text-sm text-muted-foreground">Suivi des recettes et dépenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!transactions.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle transaction
          </Button>
        </div>
      </div>

      <FinancesKpis {...totals} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList>
            <TabsTrigger value="all">Tout</TabsTrigger>
            <TabsTrigger value="recette">Recettes</TabsTrigger>
            <TabsTrigger value="depense">Dépenses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <TransactionsTable
        transactions={transactions}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={!!editing}
        form={form}
        setForm={setForm}
        onSubmit={submit}
        submitting={saveMutation.isPending}
      />
    </div>
  );
}
