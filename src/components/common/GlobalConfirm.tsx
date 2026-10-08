import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let push: ((p: Pending) => void) | null = null;

/** Libellé du bouton déduit de la question : jamais « OK ». */
export function inferConfirmLabel(title: string): string {
  const m = title.trim().match(/^(Supprimer|Restaurer|Annuler|Recalculer|Renuméroter|Émettre|Détacher|Définir|Importer|Valider|Archiver)/i);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : "Confirmer";
}

/**
 * Remplace window.confirm : `if (!(await askConfirm("Supprimer … ?"))) return;`
 * Le titre est la question ; la description, la conséquence.
 */
export function askConfirm(input: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof input === "string" ? splitMessage(input) : input;
  return new Promise((resolve) => {
    if (!push) return resolve(false);
    push({ ...opts, resolve });
  });
}

function splitMessage(msg: string): ConfirmOptions {
  const clean = msg.replace(/^ATTENTION\s*:\s*|^Attention\s*:\s*/i, "").replace(/\s*Continuer\s*\?\s*$/i, "").trim();
  const [first, ...rest] = clean.split(/\n+|(?<=[.?])\s+(?=[A-ZÉ])/);
  const title = first.trim();
  return {
    title,
    description: rest.join(" ").trim() || undefined,
    destructive: /supprim|restaur|annul|écraser|détach|import/i.test(msg),
  };
}

export function GlobalConfirmHost() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    push = (p) => setQueue((q) => [...q, p]);
    return () => {
      push = null;
    };
  }, []);
  const cur = queue[0];
  const close = (ok: boolean) => {
    cur?.resolve(ok);
    setQueue((q) => q.slice(1));
  };
  return (
    <AlertDialog open={!!cur} onOpenChange={(o) => !o && close(false)}>
      {cur && (
        <AlertDialogContent onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>{cur.title}</AlertDialogTitle>
            {cur.description && <AlertDialogDescription>{cur.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelRef} onClick={() => close(false)}>{cur.cancelLabel ?? "Annuler"}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(cur.destructive && buttonVariants({ variant: "destructive" }))}
              onClick={() => close(true)}
            >
              {cur.confirmLabel ?? inferConfirmLabel(cur.title)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
