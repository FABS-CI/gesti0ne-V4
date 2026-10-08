import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Search, Plus, Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  AdvancedSearchBar,
  describeFilters,
  type AdvancedFilters,
} from "@/components/search/AdvancedSearchBar";
import { exportListePDF } from "@/lib/pdf/exportListe";
import { formatFCFA, formatDate } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  buildEmpty,
  dynFrom,
  optionMeta,
  type ResourceConfig,
  type Row,
} from "./resource-manager-types";
import { ResourceTable } from "./ResourceTable";
import { ResourceFormDialog } from "./ResourceFormDialog";
import { friendlyError } from "@/lib/friendly-error";

// Re-exports (les consommateurs importent ces types depuis ResourceManager).
export type {
  Option,
  FieldDef,
  ColumnDef,
  RowAction,
  AdvancedFiltersConfig,
  ResourceConfig,
  ComputeDefaultsFn,
} from "./resource-manager-types";

export function ResourceManager({ config }: { config: ResourceConfig }) {
  const Icon = config.icon;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const q = useDebouncedValue(search, 300);
  const [advanced, setAdvanced] = useState<AdvancedFilters>({});

  // Auto-open new dialog if ?new=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      openNew();
      // Remove the param to avoid re-opening on manual reload
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("new");
      window.history.replaceState({}, "", nextUrl.toString());
    }
  }, []);


  const advCols = {
    reference: config.advancedFilters?.columns?.reference ?? "reference",
    client: config.advancedFilters?.columns?.client ?? "client_nom",
    telephone: config.advancedFilters?.columns?.telephone ?? "telephone",
    commercial: config.advancedFilters?.columns?.commercial ?? "representant",
    ville: config.advancedFilters?.columns?.ville ?? "ville",
    date: config.advancedFilters?.columns?.date ?? "created_at",
    montant: config.advancedFilters?.columns?.montant ?? "montant_total",
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>(() => buildEmpty(config.fields));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [defaultSources, setDefaultSources] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [config.table, q, statutFilter, advanced],
    queryFn: async () => {
      const joinCfg = config.advancedFilters?.joins;
      if (joinCfg?.client && (advanced.telephone || advanced.commercial || advanced.ville)) {
        const t = joinCfg.client.table ?? "clients";
        const idField = joinCfg.client.idField ?? "client_id";
        let cq = dynFrom(t).select(idField);
        if (advanced.telephone) cq = cq.ilike("telephone", `%${advanced.telephone}%`);
        if (advanced.commercial) cq = cq.ilike("representant", `%${advanced.commercial}%`);
        if (advanced.ville) cq = cq.ilike("ville", `%${advanced.ville}%`);
        const { data: ids, error: eIds } = await cq.limit(2000);
        if (eIds) throw eIds;
        const values = (ids ?? []).map((r: Row) => r[idField]).filter(Boolean);
        if (values.length === 0) return [];
        (advanced as Row)._clientIds = values;
      }
      if (joinCfg?.commande && advanced.commande) {
        const t = joinCfg.commande.table ?? "commandes";
        const idField = joinCfg.commande.idField ?? "commande_id";
        const refField = joinCfg.commande.refField ?? "reference";
        const { data: ids, error: eIds } = await dynFrom(t)
          .select(idField)
          .ilike(refField, `%${advanced.commande}%`)
          .limit(2000);
        if (eIds) throw eIds;
        const values = (ids ?? []).map((r: Row) => r[idField]).filter(Boolean);
        if (values.length === 0) return [];
        (advanced as Row)._commandeIds = values;
      }

      let query = dynFrom(config.table).select("*");
      if (q && config.searchFields.length) {
        query = query.or(config.searchFields.map((f) => `${f}.ilike.%${q}%`).join(","));
      }
      if (config.statusFilter && statutFilter !== "all") {
        query = query.eq(config.statusFilter.field, statutFilter);
      }
      if (advanced.reference) query = query.ilike(advCols.reference, `%${advanced.reference}%`);
      if (advanced.client) query = query.ilike(advCols.client, `%${advanced.client}%`);
      if (advanced.telephone && !joinCfg?.client)
        query = query.ilike(advCols.telephone, `%${advanced.telephone}%`);
      if (advanced.commercial && !joinCfg?.client)
        query = query.ilike(advCols.commercial, `%${advanced.commercial}%`);
      if (advanced.ville && !joinCfg?.client)
        query = query.ilike(advCols.ville, `%${advanced.ville}%`);
      if (joinCfg?.client && (advanced as Row)._clientIds) {
        query = query.in(joinCfg.client.fk, (advanced as Row)._clientIds as string[]);
      }
      if (joinCfg?.commande && (advanced as Row)._commandeIds) {
        query = query.in(joinCfg.commande.fk, (advanced as Row)._commandeIds as string[]);
      }
      if (advanced.dateDu) query = query.gte(advCols.date, advanced.dateDu);
      if (advanced.dateAu) query = query.lte(advCols.date, advanced.dateAu);
      if (advanced.montantMin !== undefined)
        query = query.gte(advCols.montant, advanced.montantMin);
      if (advanced.montantMax !== undefined)
        query = query.lte(advCols.montant, advanced.montantMax);
      query = query.order(config.orderField ?? "created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const lookupFields = useMemo(
    () => config.fields.filter((f) => f.type === "lookup" && f.lookup),
    [config.fields],
  );

  const { data: lookupData = {} } = useQuery({
    queryKey: ["lookup", config.table, lookupFields.map((f) => f.name).join(",")],
    enabled: open && lookupFields.length > 0,
    queryFn: async () => {
      const result: Record<string, Row[]> = {};
      for (const fd of lookupFields) {
        const lk = fd.lookup!;
        const cols = Array.from(
          new Set([lk.valueField, lk.labelField, ...(lk.extraFields ?? [])]),
        ).join(",");
        let q2 = dynFrom(lk.table).select(cols);
        if (lk.orderBy) q2 = q2.order(lk.orderBy, { ascending: true });
        const { data, error } = await q2.limit(500);
        if (error) throw error;
        result[fd.name] = (data ?? []) as Row[];
      }
      return result;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ input }: { input: Row; keepOpen?: boolean }) => {
      const payload: Row = {};
      for (const fd of config.fields) {
        if (fd.virtual) continue;
        payload[fd.name] = input[fd.name];
      }
      if (editing) {
        const { error } = await dynFrom(config.table)
          .update(payload)
          .eq(config.idField, editing[config.idField]);
        if (error) throw error;
      } else {
        const { error } = await dynFrom(config.table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [config.table] });
      toast.success(editing ? "Modifié" : "Enregistré");
      if (vars.keepOpen) {
        setEditing(null);
        setForm(buildEmpty(config.fields));
      } else {
        setOpen(false);
      }
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await dynFrom(config.table).delete().eq(config.idField, id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.table] });
      toast.success("Supprimé");
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  async function openNew() {
    setEditing(null);
    setForm(buildEmpty(config.fields));
    setValidationErrors([]);
    setDefaultSources({});
    setOpen(true);
    if (config.computeNewDefaults) {
      try {
        const extra = await config.computeNewDefaults();
        if (extra && typeof extra === "object") {
          const raw = extra as Record<string, unknown>;
          const sources = (raw.__sources as Record<string, string> | undefined) ?? {};
          const values: Record<string, unknown> = { ...raw };
          delete values.__sources;
          setForm((prev) => ({ ...prev, ...values }));
          setDefaultSources(sources);
        }
      } catch (e) {
        console.warn("computeNewDefaults failed", e);
      }
    }
  }

  function openEdit(row: Row) {
    if (config.editHref) {
      navigate({ to: config.editHref(row) });
      return;
    }
    setEditing(row);
    const f: Row = {};
    for (const fd of config.fields) {
      const v = row[fd.name];
      f[fd.name] = fd.type === "number" || fd.type === "money" ? Number(v ?? 0) : (v ?? "");
    }
    setForm(f);
    setValidationErrors([]);
    setDefaultSources({});
    setOpen(true);
  }

  function submit(keepOpen = false) {
    for (const fd of config.fields) {
      if (fd.required && !String(form[fd.name] ?? "").trim()) {
        toast.error(`${fd.label} est requis`);
        return;
      }
    }
    const errs = config.validate?.(form, { isEdit: !!editing }) ?? [];
    if (errs.length > 0) {
      setValidationErrors(errs);
      toast.error(errs[0]);
      return;
    }
    setValidationErrors([]);
    saveMutation.mutate({ input: form, keepOpen });
  }

  function handleExport() {
    exportCsv(
      config.csvName,
      config.columns.map((c) => c.label),
      rows.map((r) =>
        config.columns.map((c) => {
          const v = r[c.name];
          if (c.type === "badge") return optionMeta(c.options, v)?.label ?? v ?? "";
          return v ?? "";
        }),
      ),
    );
  }

  function handleExportPDF() {
    const filtres: string[] = [];
    if (q) filtres.push(`Recherche : ${q}`);
    if (config.statusFilter && statutFilter !== "all") {
      const m = optionMeta(config.statusFilter.options, statutFilter);
      filtres.push(`Statut : ${m?.label ?? statutFilter}`);
    }
    filtres.push(...describeFilters(advanced));
    const isDateCol = (c: (typeof config.columns)[number]) =>
      c.type === "date" || /date|validite|échéance|echeance/i.test(c.name);
    const moneyCols = config.columns.filter((c) => c.type === "money");
    const montantTotal = moneyCols.length
      ? rows.reduce(
          (s, r) => s + moneyCols.reduce((a, c) => a + (Number(r[c.name]) || 0), 0),
          0,
        )
      : null;
    exportListePDF({
      titre: config.pdfExport?.title ?? config.title,
      colonnes: config.columns.map((c) => c.label),
      lignes: rows.map((r) =>
        config.columns.map((c) => {
          const v = r[c.name];
          if (c.type === "money") return formatFCFA(Number(v ?? 0));
          if (c.type === "badge") return optionMeta(c.options, v)?.label ?? v ?? "";
          if (isDateCol(c)) return v ? formatDate(v as string) : "";
          return v ?? "";
        }),
      ),
      filtres,
      recap: [
        { label: "Nombre total de lignes", valeur: String(rows.length) },
        ...(montantTotal != null
          ? [{ label: "Montant total", valeur: formatFCFA(montantTotal) }]
          : []),
      ],
      filename: config.pdfExport?.filename ?? config.csvName,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Icon className="h-6 w-6 text-primary" /> {config.title}
          </h1>
          {config.subtitle && <p className="text-sm text-muted-foreground">{config.subtitle}</p>}
        </div>
        <div className="flex gap-2">
          {!config.hideCsvExport && (
            <Button variant="outline" onClick={handleExport} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> Exporter
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPDF} disabled={!rows.length}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
          {!config.readOnly && (
            <Button onClick={() => (config.newHref ? navigate({ to: config.newHref }) : openNew())}>
              <Plus className="mr-2 h-4 w-4" /> {config.newLabel}
            </Button>
          )}
        </div>
      </div>

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
        {config.statusFilter && (
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {config.statusFilter.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {config.advancedFilters && (
        <div className="rounded-lg border bg-card p-3">
          <AdvancedSearchBar
            fields={config.advancedFilters.fields}
            value={advanced}
            onChange={setAdvanced}
          />
        </div>
      )}

      <ResourceTable
        config={config}
        rows={rows}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      {!(config.newHref && config.editHref) && (
        <ResourceFormDialog
          open={open}
          onOpenChange={setOpen}
          config={config}
          editing={editing}
          form={form}
          setForm={setForm}
          lookupData={lookupData}
          defaultSources={defaultSources}
          validationErrors={validationErrors}
          isPending={saveMutation.isPending}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
