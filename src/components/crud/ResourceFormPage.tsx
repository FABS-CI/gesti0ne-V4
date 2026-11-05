import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RhPageHeader } from "@/components/rh/RhPageHeader";
import { useSaveHotkey } from "@/hooks/use-save-hotkey";

import { buildEmpty, dynFrom, type ResourceConfig, type Row } from "./resource-manager-types";
import { ResourceFormBody } from "./ResourceFormBody";
import { friendlyError } from "@/lib/friendly-error";

type Props = {
  config: ResourceConfig;
  mode: "create" | "edit";
  recordId?: string;
  listPath: string;
};

export function ResourceFormPage({ config, mode, recordId, listPath }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Row>(() => buildEmpty(config.fields));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [defaultSources, setDefaultSources] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(
    mode === "edit" ? (recordId ?? null) : null,
  );

  const editing = mode === "edit";

  const { data: editingRow, isLoading: rowLoading } = useQuery({
    queryKey: [config.table, "one", recordId],
    enabled: editing && !!recordId,
    queryFn: async () => {
      const { data, error } = await dynFrom(config.table)
        .select("*")
        .eq(config.idField, recordId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Row | null;
    },
  });

  useEffect(() => {
    if (editing && editingRow) {
      const f: Row = {};
      for (const fd of config.fields) {
        const v = editingRow[fd.name];
        f[fd.name] = fd.type === "number" || fd.type === "money" ? Number(v ?? 0) : (v ?? "");
      }
      setForm(f);
    }
  }, [editing, editingRow, config.fields]);

  useEffect(() => {
    if (editing) return;
    let cancelled = false;
    (async () => {
      if (!config.computeNewDefaults) return;
      try {
        const extra = await config.computeNewDefaults();
        if (cancelled || !extra || typeof extra !== "object") return;
        const raw = extra as Record<string, unknown>;
        const sources = (raw.__sources as Record<string, string> | undefined) ?? {};
        const values: Record<string, unknown> = { ...raw };
        delete values.__sources;
        setForm((prev) => ({ ...prev, ...values }));
        setDefaultSources(sources);
      } catch (e) {
        console.warn("computeNewDefaults failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, config]);

  const lookupFields = useMemo(
    () => config.fields.filter((f) => f.type === "lookup" && f.lookup),
    [config.fields],
  );
  const { data: lookupData = {} } = useQuery({
    queryKey: ["lookup", config.table, lookupFields.map((f) => f.name).join(",")],
    enabled: lookupFields.length > 0,
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

  const save = useMutation({
    mutationFn: async ({ input }: { input: Row; then: "list" | "stay" | "new" }) => {
      const payload: Row = {};
      for (const fd of config.fields) {
        if (fd.virtual) continue;
        payload[fd.name] = input[fd.name];
      }
      if (editing && recordId) {
        const { error } = await dynFrom(config.table).update(payload).eq(config.idField, recordId);
        if (error) throw error;
        return { id: recordId };
      }
      const { data, error } = await dynFrom(config.table)
        .insert(payload)
        .select(config.idField)
        .maybeSingle();
      if (error) throw error;
      return { id: (data?.[config.idField] as string) ?? null };
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: [config.table] });
      toast.success(editing ? "Modifié" : "Enregistré");
      if (vars.then === "list") {
        navigate({ to: listPath });
      } else if (vars.then === "new") {
        setForm(buildEmpty(config.fields));
        setSavedId(null);
      } else {
        if (res?.id) setSavedId(res.id);
      }
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  function submit(then: "list" | "stay" | "new") {
    for (const fd of config.fields) {
      if (fd.required && !String(form[fd.name] ?? "").trim()) {
        toast.error(`${fd.label} est requis`);
        return;
      }
    }
    const errs = config.validate?.(form, { isEdit: editing }) ?? [];
    if (errs.length > 0) {
      setValidationErrors(errs);
      toast.error(errs[0]);
      return;
    }
    setValidationErrors([]);
    save.mutate({ input: form, then });
  }

  useSaveHotkey(() => submit("list"), {
    onSaveAndContinue: editing ? undefined : () => submit("new"),
    enabled: !save.isPending,
  });

  if (editing && rowLoading) {
    return <div className="p-8 text-muted-foreground">Chargement…</div>;
  }
  if (editing && !editingRow) {
    return <div className="p-8 text-destructive">Élément introuvable.</div>;
  }

  return (
    <div className="space-y-6">
      <RhPageHeader
        backTo={listPath}
        title={editing ? `Modifier ${config.entityLabel}` : config.newLabel}
        subtitle={config.subtitle}
        crumbs={[
          { label: config.title, to: listPath },
          { label: editing ? "Modifier" : "Nouveau" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <ResourceFormBody
            config={config}
            editing={editing ? (editingRow ?? { [config.idField]: recordId }) : null}
            form={form}
            setForm={setForm}
            lookupData={lookupData}
            defaultSources={defaultSources}
            validationErrors={validationErrors}
          />
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => navigate({ to: listPath })}>
          Annuler
        </Button>
        {!editing && (
          <Button variant="secondary" onClick={() => submit("new")} disabled={save.isPending}>
            Enregistrer et nouveau
          </Button>
        )}
        {!editing && savedId && config.editHref && (
          <Button
            variant="secondary"
            onClick={() => navigate({ to: config.editHref!({ [config.idField]: savedId } as Row) })}
          >
            Modifier l'enregistrement
          </Button>
        )}
        <Button onClick={() => submit("list")} disabled={save.isPending}>
          {editing ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </div>
  );
}
