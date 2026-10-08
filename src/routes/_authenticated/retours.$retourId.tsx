import { PageHeader } from "@/components/common/PageHeader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  User,
  Package,
  Calendar,
  MapPin,
  Phone,
  Printer,
  PackageCheck,
  XCircle,
  Calculator,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import {
  getRetour,
  STATUT_RETOUR_LABEL,
  receptionnerRetour,
  refuserRetourMagasin,
  refuserRetourCompta,
  getRetourSimulation,
  validerRetourCompta,
  forcerClotureRetour,
  type ReceptionLigneInput,
  type ValidationComptaOption,
  type SimulationFinanciere,
} from "@/lib/retours-api";
import { usePermissions } from "@/hooks/use-permissions";
import { invalidateRetour } from "@/lib/cache-invalidation";
import { friendlyError } from "@/lib/friendly-error";
import { formatFCFA } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/retours/$retourId")({
  component: RetourDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

const WORKFLOW_STEPS = [
  { key: "demande_creee", label: "Demande" },
  { key: "attente_reception", label: "Magasin" },
  { key: "attente_validation_compta", label: "Compta" },
  { key: "cloture", label: "Clôturé" },
] as const;

function WorkflowTimeline({ statut }: { statut: string }) {
  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.key === statut);
  const refused = statut === "refuse_magasin" || statut === "refuse_compta";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {WORKFLOW_STEPS.map((s, i) => {
        const done = !refused && currentIdx >= i;
        const active = !refused && currentIdx === i;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`rounded-full px-3 py-1 border ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : done
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.label}
            </div>
            {i < WORKFLOW_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        );
      })}
      {refused && (
        <Badge variant="destructive" className="ml-2">
          {STATUT_RETOUR_LABEL[statut]?.label ?? "Refusé"}
        </Badge>
      )}
    </div>
  );
}

function RetourDetailPage() {
  const { retourId } = Route.useParams();
  const qc = useQueryClient();
  const { has, isSuperAdmin } = usePermissions();

  const { data: retour, isLoading } = useQuery({
    queryKey: ["retour", retourId],
    queryFn: () => getRetour(retourId),
  });

  const [receptionOpen, setReceptionOpen] = useState(false);
  const [refusMagasinOpen, setRefusMagasinOpen] = useState(false);
  const [refusComptaOpen, setRefusComptaOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [clotureOpen, setClotureOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["retour", retourId] });
    invalidateRetour(qc, { clientId: retour?.client_id ?? undefined });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!retour)
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Retour introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/retours">Retour à la liste</Link>
        </Button>
      </div>
    );

  const st = STATUT_RETOUR_LABEL[retour.statut];
  const titre = retour.numero ?? retour.reference;
  const version = retour.version_no ?? 1;

  const canReceptionner =
    retour.statut === "attente_reception" && (isSuperAdmin || has("retours.receptionner"));
  const canValiderCompta =
    (retour.statut === "attente_validation_compta" || retour.statut === "receptionne") && (isSuperAdmin || has("retours.valider_compta"));
  const canRefuserMagasin =
    retour.statut === "attente_reception" && (isSuperAdmin || has("retours.refuser_magasin"));
  const canRefuserCompta =
    (retour.statut === "attente_validation_compta" || retour.statut === "receptionne") && (isSuperAdmin || has("retours.refuser_compta"));
  const canForcerCloture = isSuperAdmin && retour.statut !== "cloture";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          className="mb-0 border-0 pb-0"
          backTo="/retours"
          title={titre}
          description={`${retour.etablissement ?? retour.client_nom ?? "—"} · v${version}`}
        />
        <div className="flex items-center gap-2">
          {st && (
            <Badge style={{ backgroundColor: st.color }} className="text-white">
              {st.label}
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const { generateBonRetourPDF, downloadBlob } = await import("@/lib/pdf/fabsTemplates");
                const { buildRetourDocBase } = await import("@/lib/pdf/retour-builder");
                
                const data = await buildRetourDocBase(retour.retour_id);
                const blob = await generateBonRetourPDF(data);
                downloadBlob(blob, `bon-retour-${retour.numero || retour.reference}.pdf`);
              } catch (e) {
                toast.error("Erreur lors de la génération du PDF", { description: friendlyError(e) });
              }
            }}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <WorkflowTimeline statut={retour.statut} />
        </CardContent>
      </Card>

      {/* Barre d'actions selon rôle */}
      {(canReceptionner ||
        canValiderCompta ||
        canRefuserMagasin ||
        canRefuserCompta ||
        canForcerCloture) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Actions disponibles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canReceptionner && (
              <Button onClick={() => setReceptionOpen(true)}>
                <PackageCheck className="h-4 w-4 mr-2" />
                Réceptionner
              </Button>
            )}
            {canRefuserMagasin && (
              <Button variant="destructive" onClick={() => setRefusMagasinOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Refuser (magasin)
              </Button>
            )}
            {canValiderCompta && (
              <Button onClick={() => setValidationOpen(true)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Simuler & valider
              </Button>
            )}
            {canRefuserCompta && (
              <Button variant="destructive" onClick={() => setRefusComptaOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Refuser (compta)
              </Button>
            )}
            {canForcerCloture && (
              <Button variant="outline" onClick={() => setClotureOpen(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Forcer clôture
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={<User className="h-4 w-4" />} title="Client">
          {retour.etablissement ?? retour.client_nom ?? "—"}
        </InfoCard>
        <InfoCard icon={<User className="h-4 w-4" />} title="Représentant">
          {retour.representant_nom ?? "—"}
        </InfoCard>
        <InfoCard icon={<Phone className="h-4 w-4" />} title="Téléphone">
          {retour.telephone ?? "—"}
        </InfoCard>
        <InfoCard icon={<MapPin className="h-4 w-4" />} title="Ville">
          {retour.ville ?? "—"}
        </InfoCard>
        <InfoCard icon={<Calendar className="h-4 w-4" />} title="Date">
          {frDate(retour.date_retour)}
        </InfoCard>
        <InfoCard icon={<Package className="h-4 w-4" />} title="Produits">
          {retour.nb_produits} ({retour.total_quantite} unités)
        </InfoCard>
        <InfoCard title="Créé par">{retour.created_by_nom ?? "—"}</InfoCard>
        <InfoCard title="Réceptionné par">
          {retour.receptionne_par_nom ? (
            <>
              {retour.receptionne_par_nom}
              <div className="text-xs text-muted-foreground">{frDate(retour.receptionne_at)}</div>
            </>
          ) : (
            "—"
          )}
        </InfoCard>
        <InfoCard title="Validé compta">
          {retour.valide_compta_par_nom ? (
            <>
              {retour.valide_compta_par_nom}
              <div className="text-xs text-muted-foreground">{frDate(retour.valide_compta_at)}</div>
            </>
          ) : (
            "—"
          )}
        </InfoCard>
        {retour.motif_refus_magasin && (
          <InfoCard title="Motif refus magasin">
            <span className="text-destructive">{retour.motif_refus_magasin}</span>
          </InfoCard>
        )}
        {retour.motif_refus_compta && (
          <InfoCard title="Motif refus compta">
            <span className="text-destructive">{retour.motif_refus_compta}</span>
          </InfoCard>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produits retournés</CardTitle>
        </CardHeader>
        <CardContent>
          {retour.lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune ligne.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[5%] font-bold">N°</TableHead>
                  <TableHead className="w-[12%] font-bold">Référence</TableHead>
                  <TableHead className="w-[35%] font-bold">Désignation</TableHead>
                  <TableHead className="w-[10%] text-right font-bold">Qté Dem.</TableHead>
                  <TableHead className="w-[10%] text-right font-bold">Qté Reçue</TableHead>
                  <TableHead className="w-[13%] font-bold">État</TableHead>
                  <TableHead className="w-[15%] font-bold">Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retour.lignes.map((l, i) => (
                  <TableRow key={l.ligne_id} className="text-sm">
                    <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                    <TableCell className="font-mono text-[11px] truncate max-w-[100px]" title={l.reference_produit || ""}>
                      {l.reference_produit || "—"}
                    </TableCell>
                    <TableCell className="font-medium break-words max-w-[250px] py-3">
                      {l.designation}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{l.quantite_demandee ?? l.quantite}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {l.quantite_recue ?? "—"}
                    </TableCell>
                    <TableCell>
                      {l.etat_reception ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize font-normal">
                          {l.etat_reception.replace("_", " ")}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground break-words max-w-[120px]">
                      {l.motif || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {retour.observations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Observations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {retour.observations}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {receptionOpen && (
        <ReceptionDialog
          retourId={retour.retour_id}
          version={version}
          lignes={retour.lignes}
          onClose={() => setReceptionOpen(false)}
          onDone={invalidate}
        />
      )}
      {refusMagasinOpen && (
        <MotifDialog
          title="Refuser la demande (magasin)"
          onSubmit={async (motif) => {
            await refuserRetourMagasin({ retour_id: retour.retour_id, version, motif });
          }}
          onClose={() => setRefusMagasinOpen(false)}
          onDone={invalidate}
        />
      )}
      {refusComptaOpen && (
        <MotifDialog
          title="Refuser la validation (compta)"
          onSubmit={async (motif) => {
            await refuserRetourCompta({ retour_id: retour.retour_id, version, motif });
          }}
          onClose={() => setRefusComptaOpen(false)}
          onDone={invalidate}
        />
      )}
      {validationOpen && (
        <ValidationComptaDialog
          retourId={retour.retour_id}
          version={version}
          onClose={() => setValidationOpen(false)}
          onDone={invalidate}
        />
      )}
      {clotureOpen && (
        <MotifDialog
          title="Forcer la clôture du retour"
          submitLabel="Clôturer"
          onSubmit={async (motif) => {
            await forcerClotureRetour({ retour_id: retour.retour_id, motif });
          }}
          onClose={() => setClotureOpen(false)}
          onDone={invalidate}
        />
      )}
    </div>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="font-medium">{children}</CardContent>
    </Card>
  );
}

// ============================================================================
// Reception Dialog
// ============================================================================
function ReceptionDialog({
  retourId,
  version,
  lignes,
  onClose,
  onDone,
}: {
  retourId: string;
  version: number;
  lignes: Array<{
    ligne_id: string;
    designation: string;
    reference_produit: string | null;
    quantite: number;
    quantite_demandee?: number | null;
  }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<ReceptionLigneInput[]>(() =>
    lignes.map((l) => ({
      ligne_id: l.ligne_id,
      quantite_recue: Number(l.quantite_demandee ?? l.quantite),
      etat_reception: "conforme",
      commentaire_reception: "",
    })),
  );

  const mutation = useMutation({
    mutationFn: () => receptionnerRetour({ retour_id: retourId, version, lignes: rows }),
    onSuccess: () => {
      toast.success("Réception enregistrée — stock mis à jour");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Réceptionner le retour</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead className="text-right">Demandé</TableHead>
                <TableHead className="text-right">Reçu</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Commentaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l, i) => (
                <TableRow key={l.ligne_id}>
                  <TableCell>
                    <div className="font-medium">{l.designation}</div>
                    <div className="text-xs text-muted-foreground">{l.reference_produit ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(l.quantite_demandee ?? l.quantite)}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={rows[i]?.quantite_recue ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setRows((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, quantite_recue: v } : r)),
                        );
                      }}
                      className="w-24 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rows[i]?.etat_reception ?? "conforme"}
                      onValueChange={(v) =>
                        setRows((prev) =>
                          prev.map((r, idx) =>
                            idx === i
                              ? { ...r, etat_reception: v as ReceptionLigneInput["etat_reception"] }
                              : r,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conforme">Conforme</SelectItem>
                        <SelectItem value="endommage">Endommagé</SelectItem>
                        <SelectItem value="manquant">Manquant</SelectItem>
                        <SelectItem value="refuse">Refusé</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={rows[i]?.commentaire_reception ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, idx) =>
                            idx === i ? { ...r, commentaire_reception: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="Optionnel"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement…" : "Confirmer la réception"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Motif dialog (refus, clôture)
// ============================================================================
function MotifDialog({
  title,
  submitLabel = "Confirmer",
  onSubmit,
  onClose,
  onDone,
}: {
  title: string;
  submitLabel?: string;
  onSubmit: (motif: string) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [motif, setMotif] = useState("");
  const mutation = useMutation({
    mutationFn: () => onSubmit(motif.trim()),
    onSuccess: () => {
      toast.success("Action enregistrée");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motif">Motif *</Label>
          <Textarea
            id="motif"
            rows={4}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Expliquez clairement la décision…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || motif.trim().length < 3}
          >
            {mutation.isPending ? "…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Validation compta (simulation + options)
// ============================================================================
function ValidationComptaDialog({
  retourId,
  version,
  onClose,
  onDone,
}: {
  retourId: string;
  version: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: simulation, isLoading } = useQuery({
    queryKey: ["retour-simulation", retourId],
    queryFn: () => getRetourSimulation(retourId),
  });
  const [option, setOption] = useState<any>("diminuer_solde");
  const [commentaire, setCommentaire] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      validerRetourCompta({
        retour_id: retourId,
        version,
        option,
        commentaire: commentaire.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Retour validé");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const optionsAvailable = useMemo(() => {
    const s = (simulation ?? {}) as SimulationFinanciere;
    const avail = {
      diminuer_solde: true,
      creer_avoir: true,
      preparer_remboursement: s.remboursement_possible !== false,
      aucun_impact: true
    };
    
    // Auto-sélection intelligente si non encore défini
    if (s.montant_total && !option) {
       if (s.impact_solde && s.impact_solde > 0) setOption("diminuer_solde");
       else setOption("creer_avoir");
    }
    
    return avail;
  }, [simulation, option]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Calculator className="inline h-5 w-5 mr-2" />
            Simulation financière & validation
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant du retour</span>
                <span className="font-semibold">
                  {formatFCFA(Number(simulation?.montant_total ?? 0))}
                </span>
              </div>
              {simulation?.impact_solde !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impact solde client</span>
                  <span className="font-semibold">
                    {formatFCFA(Number(simulation.impact_solde))}
                  </span>
                </div>
              )}
              {simulation?.avoir_disponible !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avoir disponible</span>
                  <span className="font-semibold">
                    {formatFCFA(Number(simulation.avoir_disponible))}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Option de traitement comptable *</Label>
              <Select value={option} onValueChange={(v) => setOption(v as ValidationComptaOption)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Choisir une action…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diminuer_solde" disabled={!optionsAvailable.diminuer_solde}>
                    <div className="flex flex-col">
                      <span>Créditer le solde client</span>
                      <span className="text-[10px] text-muted-foreground">Impacte directement la balance du compte</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="creer_avoir" disabled={!optionsAvailable.creer_avoir}>
                    <div className="flex flex-col">
                      <span>Émettre un avoir financier</span>
                      <span className="text-[10px] text-muted-foreground">Génère un document d'avoir utilisable plus tard</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="preparer_remboursement" disabled={!optionsAvailable.preparer_remboursement}>
                    <div className="flex flex-col">
                      <span>Remboursement direct</span>
                      <span className="text-[10px] text-muted-foreground">Sortie de caisse ou virement bancaire</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="aucun_impact" disabled={!optionsAvailable.aucun_impact}>
                    <div className="flex flex-col">
                      <span>Aucun impact financier</span>
                      <span className="text-[10px] text-muted-foreground">Clôturer sans écriture comptable</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 mt-2">
                ⚠️ Cette action est irréversible et déclenchera les écritures comptables automatiques.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="com">Commentaire</Label>
              <Textarea
                id="com"
                rows={3}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || isLoading}>
            {mutation.isPending ? "Traitement en cours…" : `Confirmer & Valider (${option})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
