import { formatDocumentReference } from "@/lib/document-reference";
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyRow } from "./shared";
import { frDate } from "@/lib/client-detail-helpers";
import { formatFCFA } from "@/lib/format";
import type { ClientRelations } from "@/lib/clients-api";
import { useNavigate } from "@tanstack/react-router";

// ---- Proformas ----
const ProformaRow = React.memo(function ProformaRow({
  p,
  onNavigate,
}: {
  p: ClientRelations["proformas"][number];
  onNavigate: (id: string) => void;
}) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onNavigate(p.proforma_id)}
    >
      <TableCell className="font-mono text-xs">{formatDocumentReference(p.reference)}</TableCell>
      <TableCell>{frDate(p.date_proforma)}</TableCell>
      <TableCell>{frDate(p.date_validite)}</TableCell>
      <TableCell>
        <Badge variant="secondary">{p.statut}</Badge>
      </TableCell>
      <TableCell className="text-right">{formatFCFA(p.montant_total)}</TableCell>
    </TableRow>
  );
});

export function ClientProformasTab({ proformas }: { proformas: ClientRelations["proformas"] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Validité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!proformas.length ? (
            <EmptyRow cols={5} label="Aucune proforma" />
          ) : (
            proformas.map((p) => (
              <ProformaRow
                key={p.proforma_id}
                p={p}
                onNavigate={(id) =>
                  navigate({ to: "/proformas/$proformaId", params: { proformaId: id } })
                }
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Bons de livraison ----
const BLRow = React.memo(function BLRow({ b }: { b: ClientRelations["bons_livraison"][number] }) {
  const navigate = useNavigate();
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate({ to: "/colisage/$blId", params: { blId: b.bl_id } })}
    >
      <TableCell className="font-mono text-xs">{formatDocumentReference(b.reference)}</TableCell>
      <TableCell>{frDate(b.date_emission)}</TableCell>
      <TableCell>{frDate(b.date_livraison)}</TableCell>
      <TableCell>
        <Badge variant="secondary">{b.statut}</Badge>
      </TableCell>
      <TableCell className="text-right">{formatFCFA(b.montant_total)}</TableCell>
    </TableRow>
  );
});

export function ClientBLTab({
  bons_livraison,
}: {
  bons_livraison: ClientRelations["bons_livraison"];
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Émission</TableHead>
            <TableHead>Livraison</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!bons_livraison.length ? (
            <EmptyRow cols={5} label="Aucun bon de livraison" />
          ) : (
            bons_livraison.map((b) => <BLRow key={b.bl_id} b={b} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Avoirs ----
const AvoirRow = React.memo(function AvoirRow({
  a,
  onNavigate,
}: {
  a: ClientRelations["avoirs"][number];
  onNavigate: (id: string) => void;
}) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate(a.retour_id)}>
      <TableCell className="font-mono text-xs">{formatDocumentReference(a.reference)}</TableCell>
      <TableCell>{frDate(a.date_retour)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{a.motif || "—"}</TableCell>
      <TableCell>
        <Badge variant="secondary">{a.statut}</Badge>
      </TableCell>
      <TableCell className="text-right">{formatFCFA(a.montant)}</TableCell>
    </TableRow>
  );
});

export function ClientAvoirsTab({ avoirs }: { avoirs: ClientRelations["avoirs"] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!avoirs.length ? (
            <EmptyRow cols={5} label="Aucun avoir / retour" />
          ) : (
            avoirs.map((a) => (
              <AvoirRow
                key={a.retour_id}
                a={a}
                onNavigate={(id) => navigate({ to: "/retours/$retourId", params: { retourId: id } })}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Livraisons ----
const LivraisonRow = React.memo(function LivraisonRow({
  l,
}: {
  l: ClientRelations["livraisons"][number];
}) {
  const navigate = useNavigate();
  const blId = l.bl_id;
  return (
    <TableRow
      className={blId ? "cursor-pointer hover:bg-muted/50" : undefined}
      onClick={blId ? () => navigate({ to: "/colisage/$blId", params: { blId } }) : undefined}
    >
      <TableCell className="font-mono text-xs">{formatDocumentReference(l.reference)}</TableCell>
      <TableCell>{frDate(l.date_livraison)}</TableCell>
      <TableCell>{l.transporteur || "—"}</TableCell>
      <TableCell>
        <Badge variant="secondary">{l.statut}</Badge>
      </TableCell>
    </TableRow>
  );
});

export function ClientLivraisonsTab({ livraisons }: { livraisons: ClientRelations["livraisons"] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Transporteur</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!livraisons.length ? (
            <EmptyRow cols={4} label="Aucune livraison" />
          ) : (
            livraisons.map((l) => <LivraisonRow key={l.livraison_id} l={l} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}
