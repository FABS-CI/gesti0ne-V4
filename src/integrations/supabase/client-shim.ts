// Shim temporaire (Lot 3 en cours) : ré-exporte le client typé en `any`.
import { supabase as typedSupabase } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = typedSupabase;
