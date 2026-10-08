import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateLong } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";

type Props = {
  nbRetards?: number;
  nbStockBas?: number;
};

/** Bandeau d'information : prénom, date, et points en attente (données déjà chargées). */
export function WelcomeGreeting({ nbRetards = 0, nbStockBas = 0 }: Props) {
  const { user } = useAuth();
  const { has } = usePermissions();

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

  const name = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const found = [profile?.nom_complet, meta.prenom, meta.first_name, meta.full_name, meta.name, user?.email?.split("@")[0]]
      .find((v): v is string => typeof v === "string" && v.trim().length > 0);
    return (found ?? "").split(/\s+/)[0];
  }, [user, profile]);

  const points: { label: string; to: string }[] = [];
  if (nbRetards > 0 && has("factures.voir"))
    points.push({ label: `${nbRetards} facture${nbRetards > 1 ? "s" : ""} en retard`, to: "/factures" });
  if (nbStockBas > 0 && has("stock.voir"))
    points.push({ label: `${nbStockBas} produit${nbStockBas > 1 ? "s" : ""} sous le seuil`, to: "/alertes-stock" });

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="text-sm">
        <span className="font-semibold">{name ? `Bonjour, ${name}` : "Bonjour"}</span>
        <span className="text-muted-foreground"> · {formatDateLong(new Date())}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        {points.length === 0
          ? "Aucun point en attente"
          : points.map((p, i) => (
              <span key={p.to}>
                {i > 0 && " · "}
                <Link to={p.to} className="font-medium text-foreground underline-offset-4 hover:underline">
                  {p.label}
                </Link>
              </span>
            ))}
      </p>
    </div>
  );
}
