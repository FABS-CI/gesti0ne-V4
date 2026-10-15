import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Affiche un PDF page par page dans des <canvas> (pdf.js), sans passer par le
 * lecteur PDF du navigateur : celui-ci est bloqué dans les cadres sécurisés
 * (aperçu Lovable, certains navigateurs) et laisse alors un cadre vide.
 * En cas d'échec de pdf.js, repli sur un <iframe> classique.
 */
export function PdfCanvasViewer({ blob, title }: { blob: Blob; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "fallback">("loading");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    setState("loading");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const data = new Uint8Array(await blob.arrayBuffer());
        const task = pdfjs.getDocument({ data });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.replaceChildren();
        const width = Math.max(320, host.clientWidth - 24);
        const ratio = window.devicePixelRatio || 1;
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(base.width * scale)}px`;
          canvas.style.height = `${Math.floor(base.height * scale)}px`;
          canvas.className = "mx-auto mb-3 block bg-white shadow-sm";
          canvas.setAttribute("aria-label", `${title} — page ${i}`);
          host.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) setState("ok");
      } catch (e) {
        if (cancelled) return;
        console.warn("[PdfCanvasViewer] repli iframe", e);
        setFallbackUrl(URL.createObjectURL(blob));
        setState("fallback");
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [blob, title]);

  useEffect(
    () => () => {
      if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    },
    [fallbackUrl],
  );

  if (state === "fallback" && fallbackUrl) {
    return <iframe title={title} src={fallbackUrl} className="h-full w-full rounded" />;
  }

  return (
    <div className="relative h-full w-full overflow-auto rounded p-3">
      <div ref={hostRef} data-testid="pdf-canvas-pages" />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Affichage du document…
        </div>
      )}
    </div>
  );
}
