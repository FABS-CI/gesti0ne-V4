import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavoriteModules } from "@/hooks/use-smart-shortcuts";

export function ModulesFavorisCard() {
  const { modules, isLoading } = useFavoriteModules(5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">Modules favoris</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : modules.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Vos modules les plus utilisés apparaîtront ici.
          </p>
        ) : (
          <div className="space-y-2">
            {modules.map(({ module, count, meta }) => {
              return (
                <Link
                  key={module}
                  to={meta.href}
                  className="flex items-center justify-between rounded-md border bg-card p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{meta.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{count} action(s)</span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
