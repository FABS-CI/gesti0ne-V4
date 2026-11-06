import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmerReception, uploadPreuveLivraison } from "@/lib/livraison-suivi/writes";
import { friendlyError } from "@/lib/friendly-error";

/**
 * Dialogue « Confirmer la réception » — capture la signature du réceptionnaire
 * (canvas HTML5), une photo optionnelle du bon signé et un commentaire.
 * Utilise `livsuivi_confirmer_reception` côté serveur pour passer la
 * livraison à `reception_confirmee` et déclencher la clôture automatique
 * de la tournée si toutes ses livraisons sont terminées.
 */
export function ConfirmerReceptionDialog({
  livraisonId,
  defaultReceptionnaire,
  open,
  onOpenChange,
  onSuccess,
}: {
  livraisonId: string;
  defaultReceptionnaire?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [nom, setNom] = useState(defaultReceptionnaire ?? "");
  const [tel, setTel] = useState("");
  const [commentaire, setCommentaire] = useState("");

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function up() {
    drawing.current = false;
  }
  function clearSig() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  }

  const mut = useMutation({
    mutationFn: async () => {
      let signatureUrl: string | null = null;
      const c = canvasRef.current;
      if (c) {
        // Détecte si le canvas est non-vide
        const ctx = c.getContext("2d")!;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const hasInk = d.some((_, i) => i % 4 === 3 && d[i]! > 0);
        if (hasInk) {
          const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
          signatureUrl = await uploadPreuveLivraison(livraisonId, "signature", blob);
        }
      }
      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await uploadPreuveLivraison(livraisonId, "photo", photoFile);
      }
      return confirmerReception({
        id: livraisonId,
        signatureUrl,
        photoUrl,
        receptionnaireNom: nom || null,
        receptionnaireTel: tel || null,
        commentaire: commentaire || null,
      });
    },
    onSuccess: () => {
      toast.success("Réception confirmée");
      qc.invalidateQueries({ queryKey: ["livsuivi"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e, "Erreur")),
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirmer la réception"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Enregistrement…" : "Confirmer la réception"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Réceptionnaire</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom complet" />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="07 00 00 00 00"
            />
          </div>
        </div>
        <div>
          <Label className="flex items-center gap-1"> Signature</Label>
          <canvas
            ref={canvasRef}
            width={480}
            height={160}
            className="mt-1 w-full h-40 rounded-md border bg-white touch-none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
          />
          <Button type="button" size="sm" variant="ghost" onClick={clearSig} className="mt-1">
            Effacer
          </Button>
        </div>
        <div>
          <Label className="flex items-center gap-1"> Photo bon signé (optionnel)</Label>
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label>Commentaire (optionnel)</Label>
          <Textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Remarques du réceptionnaire…"
            rows={2}
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
