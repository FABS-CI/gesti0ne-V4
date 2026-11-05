import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSmartShortcuts, useShortcutMutations } from "@/hooks/use-smart-shortcuts";
import { PersonnaliserRaccourcisDialog } from "./PersonnaliserRaccourcisDialog";

export function MesRaccourcisCard() {
  const { shortcuts, isLoading } = useSmartShortcuts(8);
  const { pin, unpin, hide } = useShortcutMutations();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Mes raccourcis</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Personnaliser
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : shortcuts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun raccourci pour le moment. Utilisez l'application, vos favoris apparaîtront ici.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {shortcuts.map(({ def, stat, pinned }) => {
              const usage = stat?.usage_count ?? 0;
              return (
                <div key={def.key} className="group relative">
                  <Link
                    to={def.href}
                    className="flex h-full flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                  >
                    {pinned && (
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Épinglé
                      </span>
                    )}
                    <span className="text-sm font-medium leading-tight">{def.label}</span>
                    {usage >= 20 && (
                      <Badge variant="secondary" className="text-xs">
                        Favori
                      </Badge>
                    )}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {pinned ? (
                        <DropdownMenuItem onClick={() => unpin.mutate(def.key)}>
                          Désépingler
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => pin.mutate(def.key)}>
                          Épingler
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => hide.mutate(def.key)}>
                        Retirer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <PersonnaliserRaccourcisDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}
