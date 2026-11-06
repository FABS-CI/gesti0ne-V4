import { Link } from "@tanstack/react-router";
import { formatDateLong } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";

type Props = {
  nbRetards?: number;
  nbStockBas?: number;
};

/** Bandeau d'état du jour : date et points en attente (données déjà chargées). */
export function WelcomeGreeting({ nbRetards = 0, nbStockBas = 0 }: Props) {
  const { has } = usePermissions();

  const points: { label: string; to: string }[] = [];
  if (nbRetards > 0 && has("factures.voir"))
    points.push({
      label: `${nbRetards} facture${nbRetards > 1 ? "s" : ""} en retard`,
      to: "/factures",
    });
  if (nbStockBas > 0 && has("stock.voir"))
    points.push({
      label: `${nbStockBas} produit${nbStockBas > 1 ? "s" : ""} sous le seuil`,
      to: "/alertes-stock",
    });

  return (
    <div
      className="flex flex-col gap-1 rounded-md border bg-card px-4 py-2.5 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="text-sm text-muted-foreground first-letter:uppercase">
        {formatDateLong(new Date())}
      </p>
      <p className="text-sm text-muted-foreground">
        {points.length === 0
          ? "Aucun point en attente"
          : points.map((p, i) => (
              <span key={p.to}>
                {i > 0 && " · "}
                <Link
                  to={p.to}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {p.label}
                </Link>
              </span>
            ))}
      </p>
    </div>
  );
}
