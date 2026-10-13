import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Bouton de filtre de la barre : Popover sur ordinateur et tablette,
 * tiroir plein écran sous 768 px.
 */
export function FilterTrigger({
  label,
  count = 0,
  summary,
  hint,
  open,
  onOpenChange,
  children,
  width = "w-80",
}: {
  label: string;
  count?: number;
  summary?: string;
  hint?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: ReactNode;
  width?: string;
}) {
  const isMobile = useIsMobile(768);
  const active = count > 0 || !!summary;
  const button = (
    <Button
      variant="outline"
      size="sm"
      title={hint}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={isMobile ? () => onOpenChange(true) : undefined}
      className={cn(
        "h-11 shrink-0 gap-1.5 font-normal md:h-9",
        active && "border-primary/60 text-foreground",
      )}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
      <span className={cn(active && "font-medium")}>
        {summary ?? (count > 0 ? `${label} · ${count}` : label)}
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {button}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="flex h-[100dvh] flex-col p-0">
            <SheetHeader className="border-b p-4 text-left">
              <SheetTitle className="text-base">{label}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent align="start" className={cn("p-0 shadow-sm", width)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
