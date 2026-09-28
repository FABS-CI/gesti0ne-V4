// Shim temporaire (Lot 3 en cours) : context.supabase en `any`.
import { requireSupabaseAuth as realMiddleware } from "./auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireSupabaseAuth: any = realMiddleware;
