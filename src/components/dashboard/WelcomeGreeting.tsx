import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { Sun, CloudSun, Moon, Sparkles } from "lucide-react";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  pickWelcomeMessage,
  roleKeyFromAppRoles,
  type WelcomePick,
} from "@/lib/welcome-messages";

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) {
    return {
      Icon: Sun,
      salutation: (name: string) => `Bonjour, ${name}`,
      message: "Excellente journée de travail.",
                };
  }
  if (hour >= 12 && hour < 18) {
    return {
      Icon: CloudSun,
      salutation: (name: string) => `Bon après-midi, ${name}`,
      message: "Heureux de vous retrouver — bonne continuation.",
                };
  }
  return {
    Icon: Moon,
    salutation: (name: string) => `Bonsoir, ${name}`,
    message: "Bienvenue dans GESTI-one — agréable soirée de travail.",
          };
}

export function WelcomeGreeting() {
  const { user } = useAuth();
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nom_complet, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_url);

  const name = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const candidates = [
      profile?.nom_complet,
      meta.prenom,
      meta.first_name,
      meta.full_name,
      meta.name,
      user?.email?.split("@")[0],
    ];
    const found = candidates.find((v): v is string => typeof v === "string" && v.trim().length > 0);
    const raw = found ?? "Utilisateur";
    // Prénom uniquement pour un rendu naturel
    return raw.split(/\s+/)[0];
  }, [user, profile]);

  const fallbackInitials = useMemo(() => {
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const { roles } = useUserRoles();

  // Pioche une citation motivante adaptée au rôle, avec rotation anti-répétition.
  // Recalculée à chaque session (identité user) — pas à chaque render.
  const [pick, setPick] = useState<WelcomePick | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    const roleKey = roleKeyFromAppRoles(roles);
    setPick(pickWelcomeMessage(roleKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roles.join(",")]);

  const g = getGreeting(hour);

  return (
    <div
      className="relative rounded-lg border bg-card p-4 text-card-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-start gap-4">
        <Avatar className="h-12 w-12 shrink-0 border">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback className="bg-muted text-sm font-semibold">
            {fallbackInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight tracking-tight sm:text-xl">
            {g.salutation(name)}
          </p>
          {pick ? (
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3" aria-hidden />
              {pick.roleLabel}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {pick ? `« ${pick.message} »` : g.message}
          </p>
          <p className="mt-1 text-xs italic text-muted-foreground">
            {g.message}
          </p>
        </div>
        <g.Icon className={`h-7 w-7 shrink-0 text-muted-foreground`} aria-hidden />
      </div>
    </div>
  );
}
