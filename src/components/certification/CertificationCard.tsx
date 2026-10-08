import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import {
  revokeCertificationFn,
  listCertificationsFn,
} from "@/lib/certification/certification.functions";
import { ensureCertificationSafe, isCertificationActive } from "@/lib/certification/auto-certify";

/** Section « Certification numérique » d'un document commercial (facture, proforma, bon de commande). */
export function CertificationCard({ reference }: { reference: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listCertificationsFn);
  const revoke = useServerFn(revokeCertificationFn);
  const [motif, setMotif] = useState("");

  const { data: certifications = [], isLoading } = useQuery({
    queryKey: ["certifications", reference],
    queryFn: () => list({ data: { reference } }),
  });

  // Certification automatique : aucune action manuelle n'est demandée à l'utilisateur.
  useEffect(() => {
    let annule = false;
    void (async () => {
      const res = await ensureCertificationSafe(reference);
      if (!annule && res?.certified) {
        void qc.invalidateQueries({ queryKey: ["certifications", reference] });
      }
    })();
    return () => {
      annule = true;
    };
  }, [reference, qc]);

  const active =
    certifications.find((c) => isCertificationActive(c.statut)) ?? certifications[0] ?? null;

  const revokeMut = useMutation({
    mutationFn: () =>
      revoke({ data: { certificationId: active?.certification_id ?? "", reason: motif } }),
    onSuccess: () => {
      setMotif("");
      toast.success("Certification révoquée");
      void qc.invalidateQueries({ queryKey: ["certifications", reference] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Certification numérique
          </span>
          {active ? (
            <Badge variant={isCertificationActive(active.statut) ? "default" : "destructive"}>
              {isCertificationActive(active.statut) ? "ACTIVE" : active.statut}
            </Badge>
          ) : (
            <Badge variant="outline">NON CERTIFIÉ</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : active ? (
          <div className="space-y-1 text-sm">
            <div className="text-muted-foreground">
              Version {active.version}
              {active.certified_at ? ` • Émise le ${formatDate(active.certified_at)}` : ""}
            </div>
            <div className="font-mono text-[11px] break-all text-muted-foreground">
              {active.canonical_hash}
            </div>
            {active.revoked_at && (
              <p className="text-warning">
                Révoquée le {formatDate(active.revoked_at)} — {active.revocation_reason ?? "—"}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Certification automatique en cours…
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={`/verify/${encodeURIComponent(reference)}`} target="_blank" rel="noreferrer">
              Vérifier publiquement
            </a>
          </Button>
        </div>

        {active && isCertificationActive(active.statut) && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif de révocation"
              className="max-w-xs"
            />
            <Button
              size="sm"
              variant="destructive"
              disabled={!motif.trim() || revokeMut.isPending}
              onClick={() => revokeMut.mutate()}
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              Révoquer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
