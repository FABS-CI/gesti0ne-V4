import { useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientsDebiteurs, type ClientDebiteur } from "@/hooks/use-clients-debiteurs";
import { formatFCFA } from "@/lib/format";

const PAGE_SIZE = 20;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Props = {
  value: string | null;
  onSelect: (client: ClientDebiteur) => void;
};

export function ClientsDebiteursSelector({ value, onSelect }: Props) {
  const { data: clients = [], isLoading, isError, refetch } = useClientsDebiteurs();
  const [q, setQ] = useState("");
  const [ville, setVille] = useState<string>("__all__");
  const [page, setPage] = useState(1);

  const villes = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) if (c.ville) set.add(c.ville);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [clients]);

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return clients.filter((c) => {
      if (ville !== "__all__" && c.ville !== ville) return false;
      if (!nq) return true;
      const hay = normalize(
        [c.nom, c.reference, c.representant ?? "", c.telephone ?? "", c.ville ?? ""].join(" "),
      );
      return hay.includes(nq);
    });
  }, [clients, q, ville]);

  const totalCreances = useMemo(
    () => filtered.reduce((s, c) => s + Number(c.solde), 0),
    [filtered],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">1. Sélection du client débiteur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher nom, référence, représentant, ville, tél…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                resetPage();
              }}
            />
          </div>
          <Select
            value={ville}
            onValueChange={(v) => {
              setVille(v);
              resetPage();
            }}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Toutes les villes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes les villes</SelectItem>
              {villes.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <p className="text-sm text-muted-foreground">Chargement des clients débiteurs…</p>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <div>
              <p className="font-medium">Impossible de charger les clients débiteurs.</p>
              <p className="text-sm text-muted-foreground">Veuillez réessayer.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Réessayer
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <UserCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Aucun client débiteur</p>
            <p className="text-sm text-muted-foreground">
              {clients.length === 0
                ? "Tous les clients sont actuellement soldés."
                : "Aucun client ne correspond à la recherche ou au filtre."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">
                {filtered.length} client{filtered.length > 1 ? "s" : ""} débiteur
                {filtered.length > 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground">
                Créances : <span className="font-semibold text-foreground">{formatFCFA(totalCreances)}</span>
              </span>
            </div>

            {/* Tableau (desktop) */}
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Représentant</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead className="text-right">Factures impayées</TableHead>
                    <TableHead className="text-right">Total dû</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((c) => (
                    <TableRow
                      key={c.client_id}
                      className={`cursor-pointer ${value === c.client_id ? "bg-primary/5" : ""}`}
                      onClick={() => onSelect(c)}
                    >
                      <TableCell>
                        <div className="font-medium">{c.nom}</div>
                        <div className="text-xs text-muted-foreground">{c.reference}</div>
                      </TableCell>
                      <TableCell>{c.representant ?? "—"}</TableCell>
                      <TableCell>{c.telephone ?? "—"}</TableCell>
                      <TableCell>{c.ville ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {c.nbFacturesImpayees} facture{c.nbFacturesImpayees > 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatFCFA(c.solde)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={value === c.client_id ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(c);
                          }}
                        >
                          {value === c.client_id ? "Sélectionné" : "Sélectionner"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Cartes (mobile) */}
            <div className="space-y-2 md:hidden">
              {pageRows.map((c) => (
                <div
                  key={c.client_id}
                  className={`rounded-md border p-3 ${value === c.client_id ? "border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.ville ?? "—"} · {c.telephone ?? "—"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={value === c.client_id ? "default" : "outline"}
                      onClick={() => onSelect(c)}
                    >
                      {value === c.client_id ? "Sélectionné" : "Sélectionner"}
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {c.nbFacturesImpayees} facture{c.nbFacturesImpayees > 1 ? "s" : ""} impayée
                      {c.nbFacturesImpayees > 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold">{formatFCFA(c.solde)}</span>
                  </div>
                </div>
              ))}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {(currentPage - 1) * PAGE_SIZE + 1} –{" "}
                  {Math.min(currentPage * PAGE_SIZE, filtered.length)} sur {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <span className="px-2">
                    {currentPage} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
