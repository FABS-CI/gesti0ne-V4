import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Banknote, Briefcase, Download, IdCard, Loader2, Phone, Plus, Save, Trash2, Upload, UserCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

import {
  createEmploye,
  updateEmploye,
  uploadEmployePhoto,
  getEmployePhotoSignedUrl,
  listEmployeDocuments,
  uploadEmployeDocument,
  deleteEmployeDocument,
  getEmployeDocumentSignedUrl,
  listDepartementsBase,
  listFonctions,
  createFonction,
  DEPARTEMENTS,
  SEXES,
  SITUATIONS_MATRIMONIALES,
  TYPES_CONTRAT,
  STATUTS_EMPLOYE,
  TEMPS_TRAVAIL,
  MODES_PAIEMENT,
  TYPES_DOCUMENT_EMPLOYE,
  type Employe,
  type EmployeInput,
  type EmployeDocument,
} from "@/lib/rh-api";
import { employeSchema, type EmployeFormValues } from "@/lib/employe-form";
import { EmployeeSearchSelect } from "@/components/search/EmployeeSearchSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createEmployeAccount,
  detachEmployeAccount,
  getEmployeAccountStatus,
  getEmployeAuditHistory,
  resetEmployePassword,
  setEmployeAccountBan,
} from "@/lib/employe-account.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { friendlyError } from "@/lib/friendly-error";

function buildInitial(employe?: Employe): EmployeFormValues {
  const base: EmployeFormValues = {
    nom_complet: "",
    matricule: null,
    prenoms: null,
    sexe: null,
    date_naissance: null,
    lieu_naissance: null,
    nationalite: "Ivoirienne",
    situation_matrimoniale: null,
    photo_url: null,
    numero_cni: null,
    numero_cnps: null,
    numero_securite_sociale: null,
    adresse: null,
    commune: null,
    ville: null,
    pays: "Côte d'Ivoire",
    email: null,
    telephone: null,
    telephone_secondaire: null,
    departement: "autre",
    fonction_id: null,
    poste: null,
    service: null,
    responsable_hierarchique_id: null,
    type_contrat: null,
    date_embauche: new Date().toISOString().slice(0, 10),
    date_fin_contrat: null,
    statut_employe: "actif",
    temps_travail: "temps_plein",
    categorie: null,
    echelon: null,
    site_affectation: null,
    actif: true,
    salaire: 0,
    primes: [],
    indemnites: [],
    avantages: [],
    mode_paiement: "virement",
    banque: null,
    numero_compte: null,
    devise: "XOF",
    centre_cout: null,
    niveau_etudes: null,
    diplomes: [],
    competences: [],
    certifications: [],
    contact_urgence_nom: null,
    contact_urgence_telephone: null,
    contact_urgence_lien: null,
    observations: null,
  };
  if (!employe) return base;
  const merged: EmployeFormValues = { ...base };
  for (const k of Object.keys(base) as (keyof EmployeFormValues)[]) {
    const v = (employe as unknown as Record<string, unknown>)[k as string];
    if (v !== undefined) (merged as Record<string, unknown>)[k as string] = v as never;
  }
  merged.salaire = Number(employe.salaire ?? 0);
  return merged;
}

export function EmployeForm({ employe }: { employe?: Employe }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editing = !!employe;
  const [form, setForm] = useState<EmployeFormValues>(() => buildInitial(employe));
  const [tab, setTab] = useState("identite");

  const set = <K extends keyof EmployeFormValues>(k: K, v: EmployeFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const departementsQ = useQuery({
    queryKey: ["departements-base"],
    queryFn: listDepartementsBase,
  });
  const fonctionsQ = useQuery({ queryKey: ["fonctions-actives"], queryFn: listFonctions });

  const photoUrlQ = useQuery({
    queryKey: ["employe-photo", form.photo_url],
    queryFn: () =>
      form.photo_url ? getEmployePhotoSignedUrl(form.photo_url) : Promise.resolve(null),
    enabled: !!form.photo_url,
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = employeSchema.safeParse(form);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        throw new Error(firstIssue?.message ?? "Formulaire invalide");
      }
      const input = parsed.data as EmployeInput;
      return editing ? updateEmploye(employe!.employe_id, input) : createEmploye(input);
    },
    onSuccess: (emp) => {
      toast.success(editing ? "Employé modifié" : "Employé créé");
      qc.invalidateQueries({ queryKey: ["employes"] });
      qc.invalidateQueries({ queryKey: ["employe", emp.employe_id] });
      qc.invalidateQueries({ queryKey: ["rh-dashboard"] });
      qc.invalidateQueries({ queryKey: ["paie"] });
      qc.invalidateQueries({ queryKey: ["bulletins"] });
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["conges"] });
      if (!editing) navigate({ to: "/employes" });
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">
            {editing ? `Modifier — ${employe!.nom_complet}` : "Nouvel employé"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {editing ? `Matricule ${employe!.matricule}` : "Renseignez les informations complètes"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/employes" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="identite">Identité</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="professionnel">Professionnel</TabsTrigger>
          <TabsTrigger value="financier">Financier</TabsTrigger>
          <TabsTrigger value="administratif">Administratif</TabsTrigger>
          <TabsTrigger value="documents" disabled={!editing}>
            Documents
          </TabsTrigger>
          <TabsTrigger value="compte" disabled={!editing}>
            Compte
          </TabsTrigger>
          <TabsTrigger value="historique" disabled={!editing}>
            Historique
          </TabsTrigger>
        </TabsList>

        {/* IDENTITÉ */}
        <TabsContent value="identite">
          <Card>
            <SectionHeader icon={UserCircle2} title="Identité" color="#3B82F6" />
            <CardContent className="grid gap-4 sm:grid-cols-2 pl-5 sm:pl-6">
              <div className="sm:col-span-2 flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={photoUrlQ.data ?? undefined} />
                  <AvatarFallback>
                    {(form.nom_complet || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <PhotoUpload
                  employeId={employe?.employe_id}
                  onUploaded={(path) => set("photo_url", path)}
                />
              </div>
              <Field label="Matricule">
                <Input
                  value={form.matricule ?? ""}
                  onChange={(e) => set("matricule", e.target.value)}
                  placeholder={editing ? employe!.matricule : "Auto si vide"}
                />
              </Field>
              <Field label="Nom *">
                <Input
                  value={form.nom_complet}
                  onChange={(e) => set("nom_complet", e.target.value)}
                />
              </Field>
              <Field label="Prénoms">
                <Input
                  value={form.prenoms ?? ""}
                  onChange={(e) => set("prenoms", e.target.value)}
                />
              </Field>
              <Field label="Sexe">
                <SelectEnum
                  value={form.sexe}
                  onChange={(v) => set("sexe", v as EmployeFormValues["sexe"])}
                  options={SEXES}
                />
              </Field>
              <Field label="Date de naissance">
                <Input
                  type="date"
                  value={form.date_naissance ?? ""}
                  onChange={(e) => set("date_naissance", e.target.value || null)}
                />
              </Field>
              <Field label="Lieu de naissance">
                <Input
                  value={form.lieu_naissance ?? ""}
                  onChange={(e) => set("lieu_naissance", e.target.value)}
                />
              </Field>
              <Field label="Nationalité">
                <Input
                  value={form.nationalite ?? ""}
                  onChange={(e) => set("nationalite", e.target.value)}
                />
              </Field>
              <Field label="Situation matrimoniale">
                <SelectEnum
                  value={form.situation_matrimoniale}
                  onChange={(v) =>
                    set("situation_matrimoniale", v as EmployeFormValues["situation_matrimoniale"])
                  }
                  options={SITUATIONS_MATRIMONIALES}
                />
              </Field>
              <Field label="N° CNI / Passeport">
                <Input
                  value={form.numero_cni ?? ""}
                  onChange={(e) => set("numero_cni", e.target.value)}
                />
              </Field>
              <Field label="N° CNPS">
                <Input
                  value={form.numero_cnps ?? ""}
                  onChange={(e) => set("numero_cnps", e.target.value)}
                />
              </Field>
              <Field label="N° Sécurité sociale">
                <Input
                  value={form.numero_securite_sociale ?? ""}
                  onChange={(e) => set("numero_securite_sociale", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT */}
        <TabsContent value="contact">
          <Card>
            <SectionHeader icon={Phone} title="Contact" color="#0EA5E9" />
            <CardContent className="grid gap-4 sm:grid-cols-2 pl-5 sm:pl-6">
              <Field label="Adresse" full>
                <Input
                  value={form.adresse ?? ""}
                  onChange={(e) => set("adresse", e.target.value)}
                />
              </Field>
              <Field label="Commune">
                <Input
                  value={form.commune ?? ""}
                  onChange={(e) => set("commune", e.target.value)}
                />
              </Field>
              <Field label="Ville">
                <Input value={form.ville ?? ""} onChange={(e) => set("ville", e.target.value)} />
              </Field>
              <Field label="Pays">
                <Input value={form.pays ?? ""} onChange={(e) => set("pays", e.target.value)} />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  value={form.telephone ?? ""}
                  onChange={(e) => set("telephone", e.target.value)}
                />
              </Field>
              <Field label="Téléphone secondaire">
                <Input
                  value={form.telephone_secondaire ?? ""}
                  onChange={(e) => set("telephone_secondaire", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROFESSIONNEL */}
        <TabsContent value="professionnel">
          <Card>
            <SectionHeader icon={Briefcase} title="Informations professionnelles" color="#8B5CF6" />
            <CardContent className="grid gap-4 sm:grid-cols-2 pl-5 sm:pl-6">
              <Field label="Département *">
                <Select value={form.departement} onValueChange={(v) => set("departement", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTEMENTS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Service">
                <Input
                  value={form.service ?? ""}
                  onChange={(e) => set("service", e.target.value)}
                />
              </Field>
              <Field label="Fonction">
                <FonctionPicker
                  value={form.fonction_id ?? null}
                  onChange={(id) => set("fonction_id", id)}
                  fonctions={fonctionsQ.data ?? []}
                  onCreated={() => qc.invalidateQueries({ queryKey: ["fonctions-actives"] })}
                />
              </Field>
              <Field label="Poste">
                <Input value={form.poste ?? ""} onChange={(e) => set("poste", e.target.value)} />
              </Field>
              <Field label="Responsable hiérarchique" full>
                <EmployeeSearchSelect
                  value={form.responsable_hierarchique_id ?? null}
                  onChange={(id) => set("responsable_hierarchique_id", id)}
                />
              </Field>
              <Field label="Type de contrat">
                <SelectEnum
                  value={form.type_contrat}
                  onChange={(v) => set("type_contrat", v as EmployeFormValues["type_contrat"])}
                  options={TYPES_CONTRAT}
                />
              </Field>
              <Field label="Statut">
                <SelectEnum
                  value={form.statut_employe}
                  onChange={(v) => set("statut_employe", v as EmployeFormValues["statut_employe"])}
                  options={STATUTS_EMPLOYE}
                />
              </Field>
              <Field label="Date d'embauche *">
                <Input
                  type="date"
                  value={form.date_embauche}
                  onChange={(e) => set("date_embauche", e.target.value)}
                />
              </Field>
              <Field label="Date fin de contrat">
                <Input
                  type="date"
                  value={form.date_fin_contrat ?? ""}
                  onChange={(e) => set("date_fin_contrat", e.target.value || null)}
                />
              </Field>
              <Field label="Temps de travail">
                <SelectEnum
                  value={form.temps_travail}
                  onChange={(v) => set("temps_travail", v as EmployeFormValues["temps_travail"])}
                  options={TEMPS_TRAVAIL}
                />
              </Field>
              <Field label="Catégorie">
                <Input
                  value={form.categorie ?? ""}
                  onChange={(e) => set("categorie", e.target.value)}
                />
              </Field>
              <Field label="Échelon">
                <Input
                  value={form.echelon ?? ""}
                  onChange={(e) => set("echelon", e.target.value)}
                />
              </Field>
              <Field label="Site d'affectation">
                <Input
                  value={form.site_affectation ?? ""}
                  onChange={(e) => set("site_affectation", e.target.value)}
                />
              </Field>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={form.actif} onCheckedChange={(v) => set("actif", v)} />
                <Label>Employé actif</Label>
              </div>
              {departementsQ.data?.length ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  {departementsQ.data.length} département(s) référencés.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FINANCIER */}
        <TabsContent value="financier">
          <Card>
            <SectionHeader icon={Banknote} title="Rémunération & paiement" color="#10B981" />
            <CardContent className="grid gap-4 sm:grid-cols-2 pl-5 sm:pl-6">
              <Field label="Salaire de base (FCFA) *">
                <Input
                  type="number"
                  min={0}
                  value={form.salaire}
                  onChange={(e) => set("salaire", Number(e.target.value))}
                />
              </Field>
              <Field label="Mode de paiement">
                <SelectEnum
                  value={form.mode_paiement}
                  onChange={(v) => set("mode_paiement", v as EmployeFormValues["mode_paiement"])}
                  options={MODES_PAIEMENT}
                />
              </Field>
              <Field label="Banque">
                <Input value={form.banque ?? ""} onChange={(e) => set("banque", e.target.value)} />
              </Field>
              <Field label="N° de compte">
                <Input
                  value={form.numero_compte ?? ""}
                  onChange={(e) => set("numero_compte", e.target.value)}
                />
              </Field>
              <Field label="Devise">
                <Input value={form.devise ?? ""} onChange={(e) => set("devise", e.target.value)} />
              </Field>
              <Field label="Centre de coût">
                <Input
                  value={form.centre_cout ?? ""}
                  onChange={(e) => set("centre_cout", e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2 space-y-3">
                <MoneyList
                  label="Primes"
                  items={form.primes ?? []}
                  onChange={(v) => set("primes", v)}
                />
                <MoneyList
                  label="Indemnités"
                  items={form.indemnites ?? []}
                  onChange={(v) => set("indemnites", v)}
                />
                <TextValueList
                  label="Avantages en nature"
                  items={form.avantages ?? []}
                  onChange={(v) => set("avantages", v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADMINISTRATIF */}
        <TabsContent value="administratif">
          <Card>
            <SectionHeader icon={IdCard} title="Administratif & sécurité sociale" color="#F97316" />
            <CardContent className="grid gap-4 sm:grid-cols-2 pl-5 sm:pl-6">
              <Field label="Niveau d'études" full>
                <Input
                  value={form.niveau_etudes ?? ""}
                  onChange={(e) => set("niveau_etudes", e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2 space-y-3">
                <DiplomeList
                  label="Diplômes"
                  items={form.diplomes ?? []}
                  onChange={(v) => set("diplomes", v)}
                />
                <DiplomeList
                  label="Certifications"
                  items={form.certifications ?? []}
                  onChange={(v) => set("certifications", v)}
                  orgLabel="Organisme"
                />
                <TagsInput
                  label="Compétences"
                  tags={form.competences ?? []}
                  onChange={(v) => set("competences", v)}
                />
              </div>
              <Field label="Contact d'urgence — nom">
                <Input
                  value={form.contact_urgence_nom ?? ""}
                  onChange={(e) => set("contact_urgence_nom", e.target.value)}
                />
              </Field>
              <Field label="Contact d'urgence — téléphone">
                <Input
                  value={form.contact_urgence_telephone ?? ""}
                  onChange={(e) => set("contact_urgence_telephone", e.target.value)}
                />
              </Field>
              <Field label="Lien de parenté">
                <Input
                  value={form.contact_urgence_lien ?? ""}
                  onChange={(e) => set("contact_urgence_lien", e.target.value)}
                />
              </Field>
              <Field label="Observations" full>
                <Textarea
                  rows={4}
                  value={form.observations ?? ""}
                  onChange={(e) => set("observations", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents">
          {editing ? <DocumentsTab employeId={employe!.employe_id} /> : null}
        </TabsContent>

        <TabsContent value="compte">
          {editing ? (
            <AccountTab employeId={employe!.employe_id} defaultEmail={employe!.email ?? ""} />
          ) : null}
        </TabsContent>
        <TabsContent value="historique">
          {editing ? <HistoriqueTab employeId={employe!.employe_id} /> : null}
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/employes" })}
          disabled={save.isPending}
        >
          <X className="mr-2 h-4 w-4" /> Annuler
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {editing ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SelectEnum<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <Select
      value={value ?? "__none"}
      onValueChange={(v) => onChange(v === "__none" ? null : (v as T))}
    >
      <SelectTrigger>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— Aucun —</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PhotoUpload({
  employeId,
  onUploaded,
}: {
  employeId?: string;
  onUploaded: (path: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function handle(f: File | null) {
    if (!f) return;
    if (!employeId) {
      toast.info("Enregistrez d'abord l'employé pour ajouter une photo.");
      return;
    }
    setBusy(true);
    try {
      const path = await uploadEmployePhoto(employeId, f);
      onUploaded(path);
      toast.success("Photo mise à jour");
    } catch (e) {
      toast.error(friendlyError(e, "Upload échoué"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Changer la photo
      </Button>
    </div>
  );
}

function MoneyList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: Array<{ libelle: string; montant: number }>;
  onChange: (v: Array<{ libelle: string; montant: number }>) => void;
}) {
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...items, { libelle: "", montant: 0 }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Ajouter
        </Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Aucun élément.</p>}
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr,140px,auto] gap-2">
          <Input
            placeholder="Libellé"
            value={it.libelle}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...it, libelle: e.target.value };
              onChange(next);
            }}
          />
          <Input
            type="number"
            min={0}
            value={it.montant}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...it, montant: Number(e.target.value) };
              onChange(next);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function TextValueList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: Array<{ libelle: string; valeur?: string }>;
  onChange: (v: Array<{ libelle: string; valeur?: string }>) => void;
}) {
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...items, { libelle: "", valeur: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Ajouter
        </Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Aucun élément.</p>}
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr,1fr,auto] gap-2">
          <Input
            placeholder="Libellé"
            value={it.libelle}
            onChange={(e) => {
              const n = [...items];
              n[i] = { ...it, libelle: e.target.value };
              onChange(n);
            }}
          />
          <Input
            placeholder="Valeur / détail"
            value={it.valeur ?? ""}
            onChange={(e) => {
              const n = [...items];
              n[i] = { ...it, valeur: e.target.value };
              onChange(n);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

type DiplomeItem = { intitule: string; annee?: number; etablissement?: string; organisme?: string };
function DiplomeList({
  label,
  items,
  onChange,
  orgLabel = "Établissement",
}: {
  label: string;
  items: DiplomeItem[];
  onChange: (v: DiplomeItem[]) => void;
  orgLabel?: string;
}) {
  const orgKey: "etablissement" | "organisme" =
    orgLabel === "Organisme" ? "organisme" : "etablissement";
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...items, { intitule: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Ajouter
        </Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Aucun élément.</p>}
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr,100px,1fr,auto] gap-2">
          <Input
            placeholder="Intitulé"
            value={it.intitule}
            onChange={(e) => {
              const n = [...items];
              n[i] = { ...it, intitule: e.target.value };
              onChange(n);
            }}
          />
          <Input
            type="number"
            placeholder="Année"
            value={it.annee ?? ""}
            onChange={(e) => {
              const n = [...items];
              n[i] = { ...it, annee: e.target.value ? Number(e.target.value) : undefined };
              onChange(n);
            }}
          />
          <Input
            placeholder={orgLabel}
            value={((it as Record<string, unknown>)[orgKey] as string) ?? ""}
            onChange={(e) => {
              const n = [...items];
              n[i] = { ...it, [orgKey]: e.target.value } as DiplomeItem;
              onChange(n);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function TagsInput({
  label,
  tags,
  onChange,
}: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v || tags.includes(v)) {
      setInput("");
      return;
    }
    onChange([...tags, v]);
    setInput("");
  };
  return (
    <div className="rounded border p-3 space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder="Ajouter une compétence puis Entrée"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function DocumentsTab({ employeId }: { employeId: string }) {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["employe-documents", employeId],
    queryFn: () => listEmployeDocuments(employeId),
  });
  const [type, setType] = useState<string>("autre");
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      await uploadEmployeDocument(employeId, f, type);
      qc.invalidateQueries({ queryKey: ["employe-documents", employeId] });
      toast.success("Document ajouté");
    } catch (e) {
      toast.error(friendlyError(e, "Upload échoué"));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function download(doc: EmployeDocument) {
    const url = await getEmployeDocumentSignedUrl(doc.storage_path);
    if (url) window.open(url, "_blank");
  }

  async function del(doc: EmployeDocument) {
    const r = await confirm({
      title: "Supprimer ce document ?",
      entityLabel: "le document",
      entityName: doc.nom,
    });
    if (r === false) return;
    await deleteEmployeDocument(doc);
    qc.invalidateQueries({ queryKey: ["employe-documents", employeId] });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Type de document">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES_DOCUMENT_EMPLOYE.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <input
            ref={ref}
            type="file"
            className="hidden"
            onChange={(e) => handle(e.target.files?.[0] ?? null)}
          />
          <Button type="button" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Ajouter un document
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document.</p>
        ) : (
          <div className="space-y-1">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded border p-2">
                <Badge variant="outline">{d.type_document}</Badge>
                <span className="flex-1 truncate text-sm">{d.nom}</span>
                <span className="text-xs text-muted-foreground">
                  {d.taille_octets ? `${Math.round(d.taille_octets / 1024)} Ko` : ""}
                </span>
                <Button size="icon" variant="ghost" onClick={() => download(d)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => del(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}

// ============================================================
// Compte utilisateur & Historique — Lot 4
// ============================================================

function AccountTab({ employeId, defaultEmail }: { employeId: string; defaultEmail: string }) {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getEmployeAccountStatus);
  const createFn = useServerFn(createEmployeAccount);
  const resetFn = useServerFn(resetEmployePassword);
  const banFn = useServerFn(setEmployeAccountBan);
  const detachFn = useServerFn(detachEmployeAccount);

  const [email, setEmail] = useState(defaultEmail);
  const statusQ = useQuery({
    queryKey: ["employe-account", employeId],
    queryFn: () => fetchStatus({ data: { employeId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["employe-account", employeId] });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { employeId, email } }),
    onSuccess: () => {
      toast.success("Invitation envoyée");
      refresh();
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });
  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { employeId } }),
    onSuccess: () => toast.success("Lien de réinitialisation envoyé"),
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });
  const banMut = useMutation({
    mutationFn: (banned: boolean) => banFn({ data: { employeId, banned } }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      refresh();
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });
  const detachMut = useMutation({
    mutationFn: () => detachFn({ data: { employeId } }),
    onSuccess: () => {
      toast.success("Compte détaché");
      refresh();
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  if (statusQ.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  if (statusQ.error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          {(statusQ.error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const s = statusQ.data!;
  if (!s.hasAccount) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Aucun compte utilisateur n'est lié à cet employé. Créez-en un pour lui donner accès à
            l'application ; un email d'invitation avec lien de définition de mot de passe sera
            envoyé.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Email du compte">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-[280px]"
              />
            </Field>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !email}>
              {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Créer le compte & inviter
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const banned = !!s.account.banned_until && new Date(s.account.banned_until) > new Date();
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Email" value={s.account.email ?? "—"} />
          <InfoRow label="Statut" value={banned ? "Désactivé" : "Actif"} />
          <InfoRow label="Créé le" value={fmt(s.account.created_at)} />
          <InfoRow label="Dernière connexion" value={fmt(s.account.last_sign_in_at)} />
          <InfoRow label="Email confirmé" value={s.account.email_confirmed_at ? "Oui" : "Non"} />
          <InfoRow label="Rôles" value={s.roles.length ? s.roles.join(", ") : "Aucun"} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => resetMut.mutate()} disabled={resetMut.isPending}>
            {resetMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Envoyer un lien de réinitialisation
          </Button>
          <Button
            variant={banned ? "default" : "destructive"}
            onClick={() => banMut.mutate(!banned)}
            disabled={banMut.isPending}
          >
            {banned ? "Réactiver le compte" : "Désactiver le compte"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (
                confirm(
                  "Détacher le compte de la fiche employé ? Le compte auth ne sera pas supprimé.",
                )
              )
                detachMut.mutate();
            }}
            disabled={detachMut.isPending}
          >
            Détacher
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function HistoriqueTab({ employeId }: { employeId: string }) {
  const fetchHistory = useServerFn(getEmployeAuditHistory);
  const q = useQuery({
    queryKey: ["employe-audit", employeId],
    queryFn: () => fetchHistory({ data: { employeId, limit: 100 } }),
  });

  if (q.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  if (q.error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          {(q.error as Error).message}
        </CardContent>
      </Card>
    );
  }
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Aucun événement d'audit.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
            <span className="text-xs text-muted-foreground w-40">{fmt(r.occurred_at)}</span>
            <Badge variant={r.status === "success" ? "secondary" : "destructive"}>{r.action}</Badge>
            {r.module && <Badge variant="outline">{r.module}</Badge>}
            {r.table_name && <span className="text-xs text-muted-foreground">{r.table_name}</span>}
            <span className="flex-1 truncate">{r.user_email ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{r.ip_address ?? ""}</span>
            {r.error_message && (
              <span className="text-xs text-destructive w-full">{r.error_message}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Unused, kept for potential future memoization needs
export const __memoNoop = () => useMemo(() => null, []);

type FonctionOption = { fonction_id: string; libelle: string; departement_id: string | null };

function FonctionPicker({
  value,
  onChange,
  fonctions,
  onCreated,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  fonctions: FonctionOption[];
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = label.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const f = await createFonction(clean);
      toast.success("Fonction créée");
      onCreated();
      onChange(f.fonction_id);
      setLabel("");
      setCreating(false);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur"));
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          value={label}
          placeholder="Nouvelle fonction…"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") {
              setCreating(false);
              setLabel("");
            }
          }}
        />
        <Button type="button" size="sm" onClick={submit} disabled={busy || !label.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setCreating(false);
            setLabel("");
          }}
        >
          Annuler
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Aucune —</SelectItem>
          {fonctions.map((f) => (
            <SelectItem key={f.fonction_id} value={f.fonction_id}>
              {f.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button aria-label="Créer une fonction"
        type="button"
        size="icon"
        variant="outline"
        title="Créer une fonction"
        onClick={() => setCreating(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
