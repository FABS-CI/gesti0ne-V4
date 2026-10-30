// Outils des tests SQL (PGlite) : lecture des fonctions telles que définies par les
// migrations du projet. Les migrations se lisent dans l'ordre d'application :
// supabase/migrations puis drizzle/migrations.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FICHIERS = [
  ...readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join("supabase/migrations", f)),
  ...readdirSync("drizzle/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join("drizzle/migrations", f)),
];

/**
 * Dernière définition d'une fonction : texte depuis « CREATE OR REPLACE FUNCTION
 * public.<signature> » jusqu'au « $$; » qui la termine. `signature` distingue les
 * surcharges : « generate_ecriture_paiement() » ou « generate_ecriture_paiement(_paiement_id ».
 * `avant` : ne lit que les migrations antérieures à ce fichier (état d'avant une correction).
 */
export function fonctionMigration(signature: string, avant?: string): string {
  let dernier: string | null = null;
  const motif = `CREATE OR REPLACE FUNCTION public.${signature}`;
  for (const f of FICHIERS) {
    if (avant && f.replace(/\\/g, "/").includes(avant)) break;
    const s = readFileSync(f, "utf8");
    for (let i = s.indexOf(motif); i >= 0; i = s.indexOf(motif, i + 1)) {
      const fin = s.indexOf("$$", s.indexOf("$$", i) + 2);
      dernier = s.slice(i, s.indexOf(";", fin) + 1);
    }
  }
  if (!dernier) throw new Error(`fonction introuvable dans les migrations : ${signature}`);
  return dernier;
}

export const migration = (nom: string) => readFileSync(join("drizzle/migrations", nom), "utf8");

/** Contexte d'un utilisateur connecté (jeton Supabase), ou contexte technique. */
export const UTILISATEUR = `SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}', false);`;
export const TECHNIQUE = `SELECT set_config('request.jwt.claims', '', false);`;

/** Rôles, auth.uid() et has_permission (refusé pour les codes de permissions_refusees). */
export const SOCLE_SUPABASE = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
  CREATE TABLE public.permissions_refusees (code text);
  CREATE FUNCTION public.has_permission(_u uuid, _c text) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT _u IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.permissions_refusees WHERE code = _c) $$;
  CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
`;

/** Tables comptables, colonnes réelles (types générés depuis la base). */
export const TABLES_COMPTA = `
  CREATE TABLE public.exercices_comptables (
    exercice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), libelle text, code text,
    date_debut date NOT NULL, date_fin date NOT NULL, statut text NOT NULL DEFAULT 'ouvert',
    is_actif boolean NOT NULL DEFAULT false, cloture_le timestamptz,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  CREATE TABLE public.journaux_comptables (journal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text);
  INSERT INTO public.journaux_comptables (code) VALUES ('VTE'), ('ACH'), ('BAN'), ('CAI'), ('OD');
  CREATE TABLE public.ecritures_comptables (
    ecriture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, exercice_id uuid,
    journal_id uuid, journal text, date_ecriture date DEFAULT current_date, libelle text,
    montant numeric DEFAULT 0, montant_total numeric DEFAULT 0, statut text DEFAULT 'brouillon',
    piece_ref text, lettrage text, source_type text, source_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.ecriture_lignes (
    ligne_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ecriture_id uuid NOT NULL REFERENCES public.ecritures_comptables(ecriture_id) ON DELETE CASCADE,
    compte_id uuid, numero_compte text, compte text, compte_libelle text, libelle text,
    debit numeric DEFAULT 0, credit numeric DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  INSERT INTO public.exercices_comptables (libelle, date_debut, date_fin, statut, is_actif)
    VALUES ('2025', '2025-01-01', '2025-12-31', 'cloture', false),
           ('2026', '2026-01-01', '2026-12-31', 'actif', true);
`;
