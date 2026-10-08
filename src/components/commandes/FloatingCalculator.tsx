import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator, Minus, X, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Calculatrice flottante auxiliaire — interface uniquement.
 * Aucune lecture/écriture de données, aucun impact sur le formulaire de commande.
 * À monter uniquement dans les écrans de saisie de commande.
 */
type Op = "+" | "-" | "*" | "/" | null;
const OP_LABEL: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? NaN : a / b;
    default: return b;
  }
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "Erreur";
  const r = Math.round(n * 1e10) / 1e10;
  const [i, d] = String(r).split(".");
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return d ? `${int},${d}` : int;
}

export function FloatingCalculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const cur = () => (display === "Erreur" ? 0 : parseFloat(display));

  const digit = useCallback((d: string) => {
    setDisplay((prev) => {
      if (fresh || prev === "0" || prev === "Erreur") return d === "." ? "0." : d;
      if (d === "." && prev.includes(".")) return prev;
      if (prev.replace(/[-.]/g, "").length >= 15) return prev;
      return prev + d;
    });
    setFresh(false);
  }, [fresh]);

  const setOperator = (next: Exclude<Op, null>) => {
    const v = cur();
    if (acc !== null && op && !fresh) {
      const r = compute(acc, v, op);
      setAcc(r);
      setDisplay(Number.isFinite(r) ? String(r) : "Erreur");
    } else {
      setAcc(v);
    }
    setOp(next);
    setFresh(true);
  };

  const equals = () => {
    if (acc === null || !op) return;
    const r = compute(acc, cur(), op);
    setDisplay(Number.isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : "Erreur");
    setAcc(null);
    setOp(null);
    setFresh(true);
  };

  const percent = () => {
    const v = cur();
    // 50000 × 10% = 5000 ; 50000 + 10% = 55000 (10% de la base)
    const p = acc !== null && (op === "+" || op === "-") ? (acc * v) / 100 : v / 100;
    setDisplay(String(Math.round(p * 1e10) / 1e10));
    setFresh(false);
  };

  const clear = () => { setDisplay("0"); setAcc(null); setOp(null); setFresh(true); };
  const back = () => {
    if (fresh) return;
    setDisplay((p) => (p.length <= 1 || p === "Erreur" || (p.length === 2 && p.startsWith("-")) ? "0" : p.slice(0, -1)));
  };

  // Clavier : actif seulement si la calculatrice est ouverte et que le focus
  // n'est pas dans un champ du formulaire (pour ne pas perturber la saisie).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inPanel = !!(t && panelRef.current?.contains(t));
      const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (inField && !inPanel) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      let handled = true;
      if (/^[0-9]$/.test(k)) digit(k);
      else if (k === "." || k === ",") digit(".");
      else if (k === "+" || k === "-" || k === "*" || k === "/") setOperator(k);
      else if (k === "%") percent();
      else if (k === "Enter" || k === "=") equals();
      else if (k === "Backspace") back();
      else if (k === "Escape") setOpen(false);
      else if (k === "Delete" || k.toLowerCase() === "c") clear();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Maintient la fenêtre dans l'écran lors d'un redimensionnement.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const clampPos = (x: number, y: number) => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 320;
    return {
      x: Math.min(Math.max(4, x), Math.max(4, window.innerWidth - w - 4)),
      y: Math.min(Math.max(4, y), Math.max(4, window.innerHeight - h - 4)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos(clampPos(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  };
  const onPointerUp = () => { drag.current = null; };

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 shadow-lg"
        aria-label="Ouvrir la calculatrice"
      >
        <Calculator className="h-4 w-4 mr-2" />
        Calculatrice
      </Button>
    );
  }

  const keys: { l: string; a: () => void; v?: "op" | "eq" | "fn" }[] = [
    { l: "7", a: () => digit("7") }, { l: "8", a: () => digit("8") }, { l: "9", a: () => digit("9") }, { l: "÷", a: () => setOperator("/"), v: "op" },
    { l: "4", a: () => digit("4") }, { l: "5", a: () => digit("5") }, { l: "6", a: () => digit("6") }, { l: "×", a: () => setOperator("*"), v: "op" },
    { l: "1", a: () => digit("1") }, { l: "2", a: () => digit("2") }, { l: "3", a: () => digit("3") }, { l: "−", a: () => setOperator("-"), v: "op" },
    { l: "0", a: () => digit("0") }, { l: ".", a: () => digit(".") }, { l: "%", a: percent, v: "op" }, { l: "+", a: () => setOperator("+"), v: "op" },
    { l: "C", a: clear, v: "fn" }, { l: "⌫", a: back, v: "fn" },
  ];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Calculatrice"
      className="fixed z-40 w-[min(240px,calc(100vw-16px))] rounded-lg border bg-card text-card-foreground shadow-2xl select-none"
      style={pos ? { left: pos.x, top: pos.y } : { right: 16, bottom: 16 }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-2 py-1.5 cursor-move touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <GripHorizontal className="h-3.5 w-3.5" />
          Calculatrice
        </div>
        <div className="flex items-center" onPointerDown={(e) => e.stopPropagation()}>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Réduire" onClick={() => setOpen(false)}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Fermer" onClick={() => { clear(); setOpen(false); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-3 pt-2 text-right">
        <div className="h-4 text-xs text-muted-foreground truncate">
          {acc !== null && op ? `${fmt(acc)} ${OP_LABEL[op]}` : ""}
        </div>
        <div className="text-2xl font-semibold tabular-nums truncate" aria-live="polite">
          {display === "Erreur" ? "Erreur" : fmt(parseFloat(display)) + (display.endsWith(".") ? "," : "")}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 p-2">
        {keys.map((k) => (
          <Button
            key={k.l}
            type="button"
            variant={k.v === "op" ? "secondary" : k.v === "fn" ? "outline" : "ghost"}
            className={cn("h-9 text-base", !k.v && "bg-muted/50", k.v === "fn" && "text-destructive")}
            onClick={k.a}
          >
            {k.l}
          </Button>
        ))}
        <Button type="button" className="col-span-2 h-9 text-base" onClick={equals}>=</Button>
      </div>
    </div>
  );
}
