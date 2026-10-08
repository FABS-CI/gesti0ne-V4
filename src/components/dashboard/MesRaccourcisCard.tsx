import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pin, PinOff, X, Settings2, Star } from "lucide-react";
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
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-primary" />
          Mes raccourcis
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Settings2 className="mr-1.5 h-4 w-4" /> Personnaliser
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
              const Icon = def.icon;
              const usage = stat?.usage_count ?? 0;
              return (
                <div key={def.key} className="group relative">
                  <Link
                    to={def.href}
                    className="flex h-full flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon className="h-5 w-5 text-primary" />
                      {pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
                    </div>
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
                        <Settings2 className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {pinned ? (
                        <DropdownMenuItem onClick={() => unpin.mutate(def.key)}>
                          <PinOff className="mr-2 h-4 w-4" /> Désépingler
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => pin.mutate(def.key)}>
                          <Pin className="mr-2 h-4 w-4" /> Épingler
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => hide.mutate(def.key)}>
                        <X className="mr-2 h-4 w-4" /> Retirer
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
