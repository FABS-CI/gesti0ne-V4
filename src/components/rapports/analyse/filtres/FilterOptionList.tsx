import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { groupKey } from "@/lib/rapports-labels";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };
export type FilterSection = { title?: string; options: FilterOption[] };

type Row =
  | { kind: "section"; title: string; values: string[] }
  | { kind: "option"; option: FilterOption };

const VIRTUAL_THRESHOLD = 100;
const ROW_H = 40;

export function FilterOptionList({
  label,
  sections,
  selected,
  onChange,
}: {
  label: string;
  sections: FilterSection[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = groupKey(useDebouncedValue(query, 300));
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sel = useMemo(() => new Set(selected), [selected]);

  const totalCount = sections.reduce((n, s) => n + s.options.length, 0);
  const { rows, visible } = useMemo(() => {
    const out: Row[] = [];
    const vis: string[] = [];
    for (const s of sections) {
      const opts = q ? s.options.filter((o) => groupKey(o.label).includes(q)) : s.options;
      if (!opts.length) continue;
      if (s.title) out.push({ kind: "section", title: s.title, values: opts.map((o) => o.value) });
      for (const o of opts) {
        out.push({ kind: "option", option: o });
        vis.push(o.value);
      }
    }
    return { rows: out, visible: vis };
  }, [sections, q]);

  const virtual = totalCount > VIRTUAL_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
    enabled: virtual,
  });

  const toggle = (v: string) =>
    onChange(sel.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const setMany = (values: string[], on: boolean) => {
    const next = new Set(selected);
    values.forEach((v) => (on ? next.add(v) : next.delete(v)));
    onChange([...next]);
  };

  const renderRow = (row: Row) => {
    if (row.kind === "section") {
      const all = row.values.every((v) => sel.has(v));
      const some = !all && row.values.some((v) => sel.has(v));
      return (
        <label className="flex h-10 cursor-pointer items-center gap-2 bg-muted/50 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Checkbox
            checked={all ? true : some ? "indeterminate" : false}
            onCheckedChange={(c) => setMany(row.values, c === true)}
            aria-label={`${row.title} : tout le cycle`}
          />
          {row.title}
          <span className="ml-auto font-normal normal-case">tout le cycle</span>
        </label>
      );
    }
    const o = row.option;
    return (
      <label className="flex h-10 cursor-pointer items-center gap-2 px-3 text-sm hover:bg-muted">
        <Checkbox checked={sel.has(o.value)} onCheckedChange={() => toggle(o.value)} />
        <span className="truncate">{o.label}</span>
      </label>
    );
  };

  return (
    <div
      className="flex flex-col"
      onKeyDown={(e) => {
        if (e.key === "/" && e.target !== inputRef.current) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Rechercher (${label.toLowerCase()})`}
          aria-label={`Rechercher dans ${label}`}
          className="h-9 pl-8"
        />
      </div>
      <div
        ref={scrollRef}
        role="group"
        aria-label={label}
        className="max-h-80 overflow-y-auto md:max-h-72"
      >
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune valeur ne correspond à « {query} ».
          </p>
        ) : virtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => (
              <div
                key={vi.key}
                className="absolute left-0 right-0"
                style={{ top: vi.start, height: ROW_H }}
              >
                {renderRow(rows[vi.index])}
              </div>
            ))}
          </div>
        ) : (
          rows.map((r, i) => <div key={i}>{renderRow(r)}</div>)
        )}
      </div>
      <div className="flex items-center gap-1 border-t p-2 text-xs">
        <Button variant="ghost" size="sm" onClick={() => setMany(visible, true)} disabled={!visible.length}>
          Tout sélectionner
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={!selected.length}>
          Tout effacer
        </Button>
        <span className={cn("ml-auto tabular-nums text-muted-foreground")}>
          {selected.length} sur {totalCount}
        </span>
      </div>
    </div>
  );
}
