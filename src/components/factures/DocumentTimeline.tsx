import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDocumentReference } from "@/lib/document-reference";
import { timelineKindLabel, type TimelineEvent } from "@/lib/document-timeline";

const dtf = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Africa/Abidjan",
});

export function DocumentTimeline({ factureId }: { factureId: string }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["document-timeline", "facture", factureId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const { data, error } = await (supabase.rpc as any)("document_timeline", {
        _type: "facture",
        _id: factureId,
      });
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historique</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">Historique indisponible.</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {data.map((e, i) => (
              <li key={`${e.occurred_at}-${i}`} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{e.label}</span>
                  {e.ref && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDocumentReference(e.ref)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dtf.format(new Date(e.occurred_at))} · {timelineKindLabel(e.kind)}
                  {e.actor_name ? ` · ${e.actor_name}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
