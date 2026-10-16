import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let allowed = new Set<string>();
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    has: (k: string) => allowed.has(k),
    hasAny: (ks: string[]) => ks.some((k) => allowed.has(k)),
    hasAll: (ks: string[]) => ks.every((k) => allowed.has(k)),
    isLoading: false,
  }),
}));
const rows = [
  {
    occurred_at: "2026-10-16T10:00:00Z",
    kind: "note",
    label: "<script>alert(1)</script>\n<b>Client</b> paie vendredi",
    actor_name: "Doris",
    ref: null,
  },
];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(async () => ({ data: rows, error: null })) },
}));
vi.mock("@/lib/rpc", () => ({ callRpc: vi.fn() }));

import { DocumentTimeline } from "./DocumentTimeline";

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DocumentTimeline factureId="f1" />
    </QueryClientProvider>,
  );
}

describe("DocumentTimeline notes", () => {
  beforeEach(() => {
    allowed = new Set();
  });

  it("masque le champ sans factures.noter mais affiche les notes", async () => {
    setup();
    expect(await screen.findByTestId("note-body")).toBeTruthy();
    expect(screen.queryByLabelText("Ajouter une note")).toBeNull();
  });

  it("affiche le champ avec factures.noter", async () => {
    allowed = new Set(["factures.noter"]);
    setup();
    expect(await screen.findByLabelText("Ajouter une note")).toBeTruthy();
  });

  it("affiche le texte brut sans interpréter le HTML", async () => {
    const { container } = setup();
    const p = await screen.findByTestId("note-body");
    expect(p.textContent).toContain("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(p.querySelector("b")).toBeNull();
  });
});
