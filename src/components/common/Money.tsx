import { formatFCFA, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({ value, className, suffix = true }: { value: number | null | undefined; className?: string; suffix?: boolean }) {
  const text = formatFCFA(value, suffix);
  return <span className={cn("tabular-nums text-right whitespace-nowrap", className)} title={formatFCFA(value)}>{text}</span>;
}

export function DateText({ value, withTime = false, className }: { value: string | Date | null | undefined; withTime?: boolean; className?: string }) {
  const text = withTime ? formatDateTime(value) : formatDate(value);
  return <time className={cn("tabular-nums", className)} title={formatDateTime(value)}>{text}</time>;
}
