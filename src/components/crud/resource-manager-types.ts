import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AdvancedFilterField } from "@/components/search/AdvancedSearchBar";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

// Dynamic table access — Supabase typed client requires a literal table name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dynFrom = (t: string) => supabase.from(t as any) as any;

export type Option = { value: string; label: string; color?: string };

export type FieldDef = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "textarea"
    | "select"
    | "money"
    | "lookup"
    | "client-search"
    | "product-search"
    | "supplier-search"
    | "employee-search";
  options?: Option[];
  required?: boolean;
  default?: string | number;
  colSpan?: 1 | 2;
  virtual?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelectPatch?: (item: any) => Row;
  lookup?: {
    table: string;
    valueField: string;
    labelField: string;
    extraFields?: string[];
    onSelectPatch?: (row: Row) => Row;
    orderBy?: string;
  };
};

export type ColumnDef = {
  name: string;
  label: string;
  type?: "text" | "date" | "money" | "number" | "badge" | "mono";
  options?: Option[];
  align?: "left" | "right";
  /** Affichage uniquement : transforme la valeur stockée avant rendu. */
  format?: (value: unknown) => string;
};

export type RowAction = {
  label: string;
  icon: LucideIcon;
  onClick?: (row: Row) => void | Promise<void>;
  to?: (row: Row) => string;
  confirm?: (row: Row) => string;
  render?: (row: Row) => ReactNode;
};

export type AdvancedFiltersConfig = {
  fields: AdvancedFilterField[];
  columns?: Partial<{
    reference: string;
    client: string;
    telephone: string;
    commercial: string;
    ville: string;
    date: string;
    montant: string;
  }>;
  joins?: {
    client?: { fk: string; table?: string; idField?: string };
    commande?: { fk: string; table?: string; idField?: string; refField?: string };
  };
};

export type ResourceConfig = {
  table: string;
  idField: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  newLabel: string;
  entityLabel: string;
  searchFields: string[];
  columns: ColumnDef[];
  fields: FieldDef[];
  statusFilter?: { field: string; options: Option[] };
  csvName: string;
  /** Masque le bouton « Exporter » (CSV) dans l'en-tête. */
  hideCsvExport?: boolean;
  rowActions?: RowAction[];
  readOnly?: boolean;
  orderField?: string;
  advancedFilters?: AdvancedFiltersConfig;
  pdfExport?: { title: string; filename?: string };
  newHref?: string;
  editHref?: (row: Row) => string;
  validate?: (row: Row, ctx: { isEdit: boolean }) => string[] | null | undefined;
  computeNewDefaults?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
};

export type ComputeDefaultsFn = () => Promise<Record<string, unknown>> | Record<string, unknown>;

export function optionMeta(options: Option[] | undefined, value: unknown) {
  return options?.find((o) => o.value === value);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function buildEmpty(fields: FieldDef[]): Row {
  const f: Row = {};
  for (const fd of fields) {
    if (fd.default !== undefined) f[fd.name] = fd.default;
    else if (fd.type === "number" || fd.type === "money") f[fd.name] = 0;
    else if (fd.type === "date") f[fd.name] = todayISO();
    else if (fd.type === "select") f[fd.name] = fd.options?.[0]?.value ?? "";
    else f[fd.name] = "";
  }
  return f;
}
