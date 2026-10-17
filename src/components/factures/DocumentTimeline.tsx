import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callRpc } from "@/lib/rpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/rbac/Can";
import { formatDocumentReference } from "@/lib/document-reference";
import { timelineKindLabel, type TimelineEvent } from "@/lib/document-timeline";

const dtf = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Africa/Abidjan",
});

const MAX_NOTE = 2000;

function NoteForm({ factureId }: { factureId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await callRpc(
        "ajouter_note_document",
        { _type: "facture", _id: factureId, _body: text },
        { module: "factures", recordId: factureId },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setBody("");
      toast.success("Note ajoutée.");
      qc.invalidateQueries({ queryKey: ["document-timeline", "facture", factureId] });
    },
    onError: () => toast.error("Erreur lors de l'ajout de la note."),
  });
  const trimmed = body.trim();
  return (
    <form
      className="mb-5 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && trimmed.length <= MAX_NOTE && !mutation.isPending) mutation.mutate(trimmed);
      }}
    >
      <label htmlFor="note-interne" className="text-sm font-medium">
        Ajouter une note
      </label>
      <Textarea
        id="note-interne"
        rows={3}
        maxLength={MAX_NOTE}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Note interne, non visible par le client"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {body.length} / {MAX_NOTE}
        </span>
        <Button type="submit" size="sm" disabled={!trimmed || mutation.isPending}>
          Ajouter
        </Button>
      </div>
    </form>
  );
}

export type TimelineDocType = "facture" | "commande" | "paiement" | "client" | "retour" | "proforma";

export function DocumentTimeline(
  props: { factureId: string } | { type: TimelineDocType; id: string },
) {
  const type: TimelineDocType = "factureId" in props ? "facture" : props.type;
  const factureId = "factureId" in props ? props.factureId : props.id;
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["document-timeline", type, factureId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const { data, error } = await callRpc("document_timeline", {
        _type: type,
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
        {type === "facture" && (
          <Can permission="factures.noter">
            <NoteForm factureId={factureId} />
          </Can>
        )}
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
                {e.kind === "note" ? (
                  <div className="text-sm">
                    <span className="mr-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                      Note
                    </span>
                    <p className="mt-1 whitespace-pre-wrap break-words" data-testid="note-body">
                      {e.label}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{humanizeTimelineLabel(e.label)}</span>
                    {e.ref && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDocumentReference(e.ref)}
                      </span>
                    )}
                  </div>
                )}
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
