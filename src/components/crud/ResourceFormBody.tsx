import type { Dispatch, SetStateAction } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientSearchSelect } from "@/components/search/ClientSearchSelect";
import { ProductSearchSelect } from "@/components/search/ProductSearchSelect";
import { SupplierSearchSelect } from "@/components/search/SupplierSearchSelect";
import { EmployeeSearchSelect } from "@/components/search/EmployeeSearchSelect";
import type { Client } from "@/lib/clients-api";
import type { Produit } from "@/lib/produits-api";
import type { Fournisseur } from "@/lib/fournisseurs-api";
import type { Employe } from "@/lib/rh-api";

import type { ResourceConfig, Row } from "./resource-manager-types";

type Props = {
  config: ResourceConfig;
  editing: Row | null;
  form: Row;
  setForm: Dispatch<SetStateAction<Row>>;
  lookupData: Record<string, Row[]>;
  defaultSources: Record<string, string>;
  validationErrors: string[];
};

export function ResourceFormBody({
  config,
  editing,
  form,
  setForm,
  lookupData,
  defaultSources,
  validationErrors,
}: Props) {
  return (
    <>
      {!editing && Object.keys(defaultSources).length > 0 && (
        <div className="rounded-md border border-info/40 bg-info/10 p-3 text-xs text-info">
          <div className="mb-1 font-medium">Champs préremplis automatiquement :</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {Object.entries(defaultSources).map(([k, src]) => {
              const label = config.fields.find((f) => f.name === k)?.label ?? k;
              return (
                <li key={k}>
                  <span className="font-medium">{label}</span> — <span>{src}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((fd) => (
          <div
            key={fd.name}
            className={`space-y-1.5 ${fd.colSpan === 2 || fd.type === "textarea" ? "sm:col-span-2" : ""}`}
          >
            <Label className="flex items-center gap-2">
              {fd.label}
              {!editing && defaultSources[fd.name] && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal border-info/40 text-info"
                >
                  {defaultSources[fd.name]}
                </Badge>
              )}
            </Label>
            {fd.type === "textarea" ? (
              <Textarea
                value={form[fd.name] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [fd.name]: e.target.value }))}
                rows={3}
              />
            ) : fd.type === "select" ? (
              <Select
                value={String(form[fd.name] ?? "")}
                onValueChange={(v) => setForm((f) => ({ ...f, [fd.name]: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fd.options?.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : fd.type === "lookup" && fd.lookup ? (
              <Select
                value={String(form[fd.name] ?? "")}
                onValueChange={(v) => {
                  const list = lookupData[fd.name] ?? [];
                  const selected = list.find((r) => String(r[fd.lookup!.valueField]) === v);
                  setForm((f) => {
                    const patch =
                      selected && fd.lookup!.onSelectPatch
                        ? fd.lookup!.onSelectPatch(selected)
                        : {};
                    return { ...f, [fd.name]: v, ...patch };
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {(lookupData[fd.name] ?? []).map((r) => (
                    <SelectItem
                      key={String(r[fd.lookup!.valueField])}
                      value={String(r[fd.lookup!.valueField])}
                    >
                      {String(r[fd.lookup!.labelField] ?? "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : fd.type === "client-search" ? (
              <ClientSearchSelect
                value={(form[fd.name] as string) ?? null}
                onChange={(id, client: Client | null) => {
                  setForm((f) => {
                    const patch = client && fd.onSelectPatch ? fd.onSelectPatch(client) : {};
                    return { ...f, [fd.name]: id, ...patch };
                  });
                }}
              />
            ) : fd.type === "product-search" ? (
              <ProductSearchSelect
                value={(form[fd.name] as string) ?? null}
                onChange={(id, p: Produit | null) => {
                  setForm((f) => {
                    const patch = p && fd.onSelectPatch ? fd.onSelectPatch(p) : {};
                    return { ...f, [fd.name]: id, ...patch };
                  });
                }}
              />
            ) : fd.type === "supplier-search" ? (
              <SupplierSearchSelect
                value={(form[fd.name] as string) ?? null}
                onChange={(id, s: Fournisseur | null) => {
                  setForm((f) => {
                    const patch = s && fd.onSelectPatch ? fd.onSelectPatch(s) : {};
                    return { ...f, [fd.name]: id, ...patch };
                  });
                }}
              />
            ) : fd.type === "employee-search" ? (
              <EmployeeSearchSelect
                value={(form[fd.name] as string) ?? null}
                onChange={(id, e: Employe | null) => {
                  setForm((f) => {
                    const patch = e && fd.onSelectPatch ? fd.onSelectPatch(e) : {};
                    return { ...f, [fd.name]: id, ...patch };
                  });
                }}
              />
            ) : (
              <Input
                type={
                  fd.type === "number" || fd.type === "money"
                    ? "number"
                    : fd.type === "date"
                      ? "date"
                      : "text"
                }
                value={form[fd.name] ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [fd.name]:
                      fd.type === "number" || fd.type === "money"
                        ? Number(e.target.value)
                        : e.target.value,
                  }))
                }
              />
            )}
          </div>
        ))}
      </div>
      {validationErrors.length > 0 && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="mb-1 font-medium">
            {validationErrors.length} incohérence{validationErrors.length > 1 ? "s" : ""} à corriger
            :
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
