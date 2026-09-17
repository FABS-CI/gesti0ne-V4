import { supabase } from "@/integrations/supabase/client";

export const DEPARTEMENTS = [
  { value: "direction", label: "Direction" },
  { value: "commercial", label: "Commercial" },
  { value: "comptabilite", label: "Comptabilité" },
  { value: "logistique", label: "Logistique" },
  { value: "production", label: "Production" },
  { value: "rh", label: "Ressources Humaines" },
  { value: "stock_magasinage", label: "Stock et magasinage" },
  { value: "autre", label: "Autre" },
] as const;

export const DEPARTEMENT_LABEL: Record<string, string> = Object.fromEntries(
  DEPARTEMENTS.map((d) => [d.value, d.label]),
);

export const TYPES_CONGE = [
  { value: "annuel", label: "Congé annuel" },
  { value: "maladie", label: "Maladie" },
  { value: "maternite", label: "Maternité" },
  { value: "exceptionnel", label: "Exceptionnel" },
  { value: "sans_solde", label: "Sans solde" },
] as const;

export const TYPE_CONGE_LABEL: Record<string, string> = Object.fromEntries(
  TYPES_CONGE.map((t) => [t.value, t.label]),
);

export const STATUTS_CONGE = [
  { value: "en_attente", label: "En attente", color: "#F97316" },
  { value: "approuve", label: "Approuvé", color: "#10B981" },
  { value: "refuse", label: "Refusé", color: "#EF4444" },
] as const;

export const STATUT_CONGE_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(STATUTS_CONGE.map((s) => [s.value, { label: s.label, color: s.color }]));

export type Employe = {
  employe_id: string;
  matricule: string;
  nom_complet: string;
  poste: string | null;
  departement: string;
  email: string | null;
  telephone: string | null;
  date_embauche: string;
  salaire: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
  // Identité
  prenoms?: string | null;
  sexe?: "M" | "F" | "autre" | null;
  date_naissance?: string | null;
  lieu_naissance?: string | null;
  nationalite?: string | null;
  situation_matrimoniale?: string | null;
  photo_url?: string | null;
  numero_cni?: string | null;
  numero_cnps?: string | null;
  numero_securite_sociale?: string | null;
  // Contact
  adresse?: string | null;
  commune?: string | null;
  ville?: string | null;
  pays?: string | null;
  telephone_secondaire?: string | null;
  // Professionnel
  fonction_id?: string | null;
  service?: string | null;
  responsable_hierarchique_id?: string | null;
  type_contrat?: string | null;
  date_fin_contrat?: string | null;
  statut_employe?: string | null;
  temps_travail?: string | null;
  categorie?: string | null;
  echelon?: string | null;
  site_affectation?: string | null;
  // Financier
  primes?: Array<{ libelle: string; montant: number }> | null;
  indemnites?: Array<{ libelle: string; montant: number }> | null;
  avantages?: Array<{ libelle: string; valeur?: string }> | null;
  mode_paiement?: string | null;
  banque?: string | null;
  numero_compte?: string | null;
  devise?: string | null;
  centre_cout?: string | null;
  // Administratif
  niveau_etudes?: string | null;
  diplomes?: Array<{ intitule: string; annee?: number; etablissement?: string }> | null;
  competences?: string[] | null;
  certifications?: Array<{ intitule: string; annee?: number; organisme?: string }> | null;
  contact_urgence_nom?: string | null;
  contact_urgence_telephone?: string | null;
  contact_urgence_lien?: string | null;
  observations?: string | null;
  // Compte
  user_id?: string | null;
};

export type EmployeInput = Partial<Omit<Employe, "employe_id" | "created_at" | "updated_at">> & {
  nom_complet: string;
  departement: string;
  date_embauche: string;
  salaire: number;
  actif: boolean;
};

export type EmployeDocument = {
  id: string;
  employe_id: string;
  type_document: string;
  nom: string;
  storage_path: string;
  mime_type: string | null;
  taille_octets: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Conge = {
  conge_id: string;
  employe_id: string;
  type: string;
  date_debut: string;
  date_fin: string;
  motif: string | null;
  statut: string;
  created_at: string;
  updated_at: string;
  employes?: { nom_complet: string; matricule: string } | null;
};

export type CongeInput = {
  employe_id: string;
  type: string;
  date_debut: string;
  date_fin: string;
  motif?: string | null;
  statut: string;
};

export async function listEmployes(q?: string) {
  let query = supabase.from("employes").select("*").is("deleted_at", null);
  if (q) query = query.or(`nom_complet.ilike.%${q}%,matricule.ilike.%${q}%,poste.ilike.%${q}%`);
  query = query.order("nom_complet", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Employe[];
}

export async function createEmploye(input: EmployeInput) {
  const payload = { ...input };
  if (!payload.matricule) delete (payload as { matricule?: string | null }).matricule;
  const { data, error } = await supabase
    .from("employes")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as Employe;
}

export async function updateEmploye(id: string, input: Partial<EmployeInput>) {
  const payload = { ...input };
  if (payload.matricule === "" || payload.matricule === null) {
    delete (payload as { matricule?: string | null }).matricule;
  }
  const { data, error } = await supabase
    .from("employes")
    .update(payload as never)
    .eq("employe_id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Employe;
}

export async function deleteEmploye(id: string) {
  const { error } = await supabase.rpc("soft_delete_employe", { _employe_id: id } as never);
  if (error) throw error;
}

/**
 * Suppression définitive d'un employé via la RPC `supprimer_employe`.
 * Bloquée par la RPC si l'employé est référencé (contrats, paie, congés,
 * missions, évaluations, colisage). L'appelant doit alors basculer sur
 * `deleteEmploye` (soft delete) pour conserver l'historique.
 */
export async function hardDeleteEmploye(id: string, motif?: string | null) {
  const { data, error } = await supabase.rpc("supprimer_employe", {
    _employe_id: id,
    _motif: motif ?? undefined,
  } as never);
  if (error) throw error;
  return data;
}

export async function restoreEmploye(id: string, retentionDays = 30) {
  const { error } = await supabase.rpc("restore_employe", {
    _employe_id: id,
    _retention_days: retentionDays,
  } as never);
  if (error) throw error;
}

export async function renumberEmployesMatricules(): Promise<number> {
  const { data, error } = await supabase.rpc("renumber_employes_matricules" as never);
  if (error) {
    if (/unique|conflit/i.test(error.message))
      throw new Error("Conflit de matricules : un matricule identique existe déjà.");
    throw error;
  }
  return (data as number) ?? 0;
}

export async function listConges(statut?: string) {
  let query = supabase.from("conges").select("*, employes(nom_complet, matricule)");
  if (statut) query = query.eq("statut", statut);
  query = query.order("date_debut", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Conge[];
}

export async function getConge(id: string) {
  const { data, error } = await supabase
    .from("conges")
    .select("*, employes(nom_complet, matricule)")
    .eq("conge_id", id)
    .single();
  if (error) throw error;
  return data as Conge;
}

export async function createConge(input: CongeInput) {
  const { data, error } = await supabase.from("conges").insert(input).select().single();
  if (error) throw error;
  return data as Conge;
}

export async function updateConge(id: string, input: Partial<CongeInput>) {
  const { data, error } = await supabase
    .from("conges")
    .update(input)
    .eq("conge_id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Conge;
}

export async function deleteConge(id: string) {
  const { error } = await supabase.from("conges").delete().eq("conge_id", id);
  if (error) throw error;
}

export async function getEmploye(id: string) {
  const { data, error } = await supabase.from("employes").select("*").eq("employe_id", id).single();
  if (error) throw error;
  return data as Employe;
}

export async function getEmployeConges(id: string) {
  const { data, error } = await supabase
    .from("conges")
    .select("*")
    .eq("employe_id", id)
    .order("date_debut", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conge[];
}

export async function getEmployeAbsences(id: string) {
  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("employe_id", id)
    .order("date_debut", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEmployeContrats(id: string) {
  const { data, error } = await supabase
    .from("contrats")
    .select("*")
    .eq("employe_id", id)
    .order("date_debut", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEmployeBulletins(id: string) {
  const { data, error } = await supabase
    .from("bulletins_paie")
    .select("*")
    .eq("employe_id", id)
    .order("periode", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type RHDashboardStats = {
  totalEmployes: number;
  employesActifs: number;
  masseSalariale: number;
  congesEnAttente: number;
  employesEnConge: number;
  absencesEnCours: number;
  contratsExpirantBientot: number;
  effectifParDepartement: { departement: string; label: string; count: number }[];
  alertes: { type: string; message: string; severite: "info" | "warning" | "danger" }[];
};

export async function getRHDashboard(): Promise<RHDashboardStats> {
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [employesRes, congesRes, absencesRes, contratsRes] = await Promise.all([
    supabase.from("employes").select("employe_id, nom_complet, departement, salaire, actif"),
    supabase.from("conges").select("conge_id, statut, date_debut, date_fin"),
    supabase.from("absences").select("absence_id, statut, date_debut, date_fin"),
    supabase.from("contrats").select("contrat_id, employe_nom, date_fin, statut"),
  ]);

  if (employesRes.error) throw employesRes.error;

  const employes = employesRes.data ?? [];
  const conges = congesRes.data ?? [];
  const absences = absencesRes.data ?? [];
  const contrats = contratsRes.data ?? [];

  const actifs = employes.filter((e) => e.actif);
  const masseSalariale = actifs.reduce((s, e) => s + (e.salaire ?? 0), 0);
  const congesEnAttente = conges.filter((c) => c.statut === "en_attente").length;
  const employesEnConge = conges.filter(
    (c) =>
      c.statut === "approuve" && c.date_debut <= todayStr && (c.date_fin ?? todayStr) >= todayStr,
  ).length;
  const absencesEnCours = absences.filter(
    (a) => a.date_debut <= todayStr && (a.date_fin ?? todayStr) >= todayStr,
  ).length;
  const contratsExpirantBientot = contrats.filter(
    (c) => c.date_fin && c.date_fin >= todayStr && c.date_fin <= in30,
  ).length;

  const deptMap = new Map<string, number>();
  for (const e of actifs) {
    deptMap.set(e.departement, (deptMap.get(e.departement) ?? 0) + 1);
  }
  const effectifParDepartement = [...deptMap.entries()].map(([departement, count]) => ({
    departement,
    label: DEPARTEMENT_LABEL[departement] ?? departement,
    count,
  }));

  const alertes: RHDashboardStats["alertes"] = [];
  if (congesEnAttente > 0)
    alertes.push({
      type: "conges",
      message: `${congesEnAttente} demande(s) de congé en attente de validation`,
      severite: "warning",
    });
  if (contratsExpirantBientot > 0)
    alertes.push({
      type: "contrats",
      message: `${contratsExpirantBientot} contrat(s) arrivent à échéance sous 30 jours`,
      severite: "danger",
    });
  if (absencesEnCours > 0)
    alertes.push({
      type: "absences",
      message: `${absencesEnCours} absence(s) en cours aujourd'hui`,
      severite: "info",
    });

  return {
    totalEmployes: employes.length,
    employesActifs: actifs.length,
    masseSalariale,
    congesEnAttente,
    employesEnConge,
    absencesEnCours,
    contratsExpirantBientot,
    effectifParDepartement,
    alertes,
  };
}

export type EmployeEnConge = {
  conge_id: string;
  employe_id: string;
  type: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  motif: string | null;
  nom_complet: string;
  matricule: string;
  departement: string;
  poste: string | null;
  jours: number;
};

export async function listEmployesEnConge(): Promise<EmployeEnConge[]> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("conges")
    .select(
      "conge_id, employe_id, type, date_debut, date_fin, statut, motif, employes(nom_complet, matricule, departement, poste)",
    )
    .eq("statut", "approuve")
    .lte("date_debut", todayStr)
    .gte("date_fin", todayStr)
    .order("date_debut", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => {
    const d1 = new Date(c.date_debut);
    const d2 = new Date(c.date_fin);
    const jours = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
    return {
      conge_id: c.conge_id,
      employe_id: c.employe_id,
      type: c.type,
      date_debut: c.date_debut,
      date_fin: c.date_fin,
      statut: c.statut,
      motif: c.motif,
      nom_complet: c.employes?.nom_complet ?? "—",
      matricule: c.employes?.matricule ?? "—",
      departement: c.employes?.departement ?? "—",
      poste: c.employes?.poste ?? null,
      jours,
    };
  });
}

// ============================================================
// Référentiels & documents employé (Lot 3)
// ============================================================

export async function listDepartementsBase() {
  const { data, error } = await supabase
    .from("departements")
    .select("departement_id, nom")
    .order("nom");
  if (error) throw error;
  return data ?? [];
}

export async function listFonctions() {
  const { data, error } = await supabase
    .from("fonctions")
    .select("fonction_id, libelle, departement_id")
    .order("libelle");
  if (error) throw error;
  return data ?? [];
}

export async function createFonction(libelle: string, departement_id?: string | null) {
  const clean = libelle.trim();
  if (!clean) throw new Error("Libellé requis");
  // Réutilise une fonction existante (insensible à la casse) si présente
  const { data: existing } = await supabase
    .from("fonctions")
    .select("fonction_id, libelle, departement_id")
    .ilike("libelle", clean)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("fonctions")
    .insert({ libelle: clean, departement_id: departement_id ?? null, actif: true })
    .select("fonction_id, libelle, departement_id")
    .single();
  if (error) throw error;
  return data;
}

export const SEXES = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
  { value: "autre", label: "Autre" },
] as const;

export const SITUATIONS_MATRIMONIALES = [
  { value: "celibataire", label: "Célibataire" },
  { value: "marie", label: "Marié(e)" },
  { value: "divorce", label: "Divorcé(e)" },
  { value: "veuf", label: "Veuf(ve)" },
  { value: "union_libre", label: "Union libre" },
] as const;

export const TYPES_CONTRAT = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "stage", label: "Stage" },
  { value: "consultant", label: "Consultant" },
  { value: "interim", label: "Intérim" },
  { value: "apprentissage", label: "Apprentissage" },
] as const;

export const STATUTS_EMPLOYE = [
  { value: "actif", label: "Actif" },
  { value: "suspendu", label: "Suspendu" },
  { value: "demission", label: "Démission" },
  { value: "licencie", label: "Licencié" },
  { value: "retraite", label: "Retraite" },
  { value: "fin_contrat", label: "Fin de contrat" },
] as const;

export const TEMPS_TRAVAIL = [
  { value: "temps_plein", label: "Temps plein" },
  { value: "temps_partiel", label: "Temps partiel" },
  { value: "forfait_jour", label: "Forfait jour" },
] as const;

export const MODES_PAIEMENT = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
] as const;

export const TYPES_DOCUMENT_EMPLOYE = [
  { value: "contrat", label: "Contrat" },
  { value: "cni", label: "CNI / Passeport" },
  { value: "diplome", label: "Diplôme" },
  { value: "certification", label: "Certification" },
  { value: "cv", label: "CV" },
  { value: "autre", label: "Autre" },
] as const;

// ---------- Photo (bucket privé, signed URL) ----------

export async function uploadEmployePhoto(employeId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${employeId}/photo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("employe-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getEmployePhotoSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("employe-photos")
    .createSignedUrl(path, 60 * 60 * 2);
  if (error) return null;
  return data.signedUrl;
}

// ---------- Documents ----------

export async function listEmployeDocuments(employeId: string): Promise<EmployeDocument[]> {
  const { data, error } = await supabase
    .from("employe_documents")
    .select("*")
    .eq("employe_id", employeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmployeDocument[];
}

export async function uploadEmployeDocument(
  employeId: string,
  file: File,
  typeDocument: string,
): Promise<EmployeDocument> {
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${employeId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("employe-documents")
    .upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("employe_documents")
    .insert({
      employe_id: employeId,
      type_document: typeDocument,
      nom: file.name,
      storage_path: path,
      mime_type: file.type,
      taille_octets: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmployeDocument;
}

export async function deleteEmployeDocument(doc: EmployeDocument): Promise<void> {
  await supabase.storage.from("employe-documents").remove([doc.storage_path]);
  const { error } = await supabase.from("employe_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

export async function getEmployeDocumentSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("employe-documents")
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
