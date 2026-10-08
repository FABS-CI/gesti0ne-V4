import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ModuleShortcut = { label: string; to: string };

export function ModulePlaceholder({
  title,
  subtitle,
  description,
  icon: Icon,
  color = "#3B82F6",
  shortcuts = [],
  bullets = [],
}: {
  title: string;
  subtitle?: string;
  description?: string;
  icon: LucideIcon;
  color?: string;
  shortcuts?: ModuleShortcut[];
  bullets?: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
            style={{ background: `${color}22`, color }}
          >
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="ds-page-title">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {shortcuts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <Button key={s.to} variant="outline" size="sm" asChild>
                <Link to={s.to}>
                  {s.label} <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
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
