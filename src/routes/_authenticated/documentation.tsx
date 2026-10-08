import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DOC_SECTIONS, type DocSection } from "@/lib/documentation-data";
import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/documentation")({
  head: () => authRouteHead("Documentation"),
  component: DocumentationPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  const nText = normalize(text);
  const marks: Array<[number, number]> = [];
  for (const term of terms) {
    if (!term) continue;
    let idx = 0;
    while ((idx = nText.indexOf(term, idx)) !== -1) {
      marks.push([idx, idx + term.length]);
      idx += term.length;
    }
  }
  if (!marks.length) return text;
  marks.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([m[0], m[1]]);
  }
  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([a, b], i) => {
    if (cursor < a) out.push(text.slice(cursor, a));
    out.push(
      <mark key={i} className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40">
        {text.slice(a, b)}
      </mark>,
    );
    cursor = b;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function scoreSection(sec: DocSection, terms: string[]): number {
  if (!terms.length) return 1;
  const title = normalize(sec.title);
  const content = normalize(sec.content);
  const module = normalize(sec.module);
  let score = 0;
  for (const t of terms) {
    if (!t) continue;
    if (title.includes(t)) score += 10;
    if (module.includes(t)) score += 5;
    const occ = content.split(t).length - 1;
    score += occ;
    if (!title.includes(t) && !module.includes(t) && occ === 0) return 0;
  }
  return score;
}

function DocumentationPage() {
  const [query, setQuery] = useState("");
  const [module, setModule] = useState<string | null>(null);

  const modules = useMemo(() => {
    return Array.from(new Set(DOC_SECTIONS.map((s) => s.module)));
  }, []);

  const terms = useMemo(
    () =>
      normalize(query)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    [query],
  );

  const results = useMemo(() => {
    let list = DOC_SECTIONS.map((s) => ({ sec: s, score: scoreSection(s, terms) })).filter(
      (r) => r.score > 0,
    );
    if (module) list = list.filter((r) => r.sec.module === module);
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [terms, module]);

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-4">
      <header className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="ds-page-title">Documentation</h1>
          <p className="text-sm text-muted-foreground">
            Recherche plein texte dans le manuel d'utilisation de l'ERP.
          </p>
        </div>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une procédure (ex: annuler paiement, transfert, inventaire, exercice clôturé)..."
          className="pl-9 h-11 text-base"
          aria-label="Rechercher dans la documentation"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModule(null)}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            module === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          Tous ({DOC_SECTIONS.length})
        </button>
        {modules.map((m) => {
          const count = DOC_SECTIONS.filter((s) => s.module === m).length;
          const active = module === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setModule(active ? null : m)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {m} ({count})
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {results.length} résultat{results.length > 1 ? "s" : ""}
        {query ? ` pour "${query}"` : ""}.
      </p>

      <div className="space-y-3">
        {results.map(({ sec }) => (
          <Card key={sec.id} className="hover:border-primary/40 transition">
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{sec.module}</Badge>
                <h2 className="text-base font-semibold">
                  {highlight(sec.title, terms)}
                </h2>
                {sec.route && (
                  <Link
                    to={sec.route}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ouvrir le module <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {highlight(sec.content, terms)}
              </p>
            </CardContent>
          </Card>
        ))}
        {results.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Aucun résultat. Essayez d'autres mots-clés (paiement, stock,
              exercice, livraison...).
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}