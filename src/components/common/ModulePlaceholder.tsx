import { Link } from "@tanstack/react-router";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ModuleShortcut = { label: string; to: string };

export function ModulePlaceholder({
  title,
  subtitle,
  description,
  color = "#3B82F6",
  shortcuts = [],
  bullets = [],
}: {
  title: string;
  subtitle?: string;
  description?: string;
  /** Ignorée : interface sans icônes décoratives. */
  icon?: LucideIcon;
  color?: string;
  shortcuts?: ModuleShortcut[];
  bullets?: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="ds-page-title">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {shortcuts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <Button key={s.to} variant="outline" size="sm" asChild>
                <Link to={s.to}>{s.label}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Présentation du module</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {description && <p className="text-muted-foreground">{description}</p>}
          {bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
