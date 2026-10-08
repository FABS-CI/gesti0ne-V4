import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

export function TimelineRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-l-2 border-primary/40 pl-3 py-1">
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}
