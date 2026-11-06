import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Animations des tableaux de bord — chiffres qui défilent jusqu'à leur valeur.
 *
 * Règles :
 *  - la valeur affichée en fin d'animation est TOUJOURS la valeur exacte reçue ;
 *  - au premier affichage le chiffre part de 0, ensuite il glisse de l'ancienne
 *    valeur vers la nouvelle (changement de période) ; une actualisation qui ne
 *    change pas la valeur ne relance rien ;
 *  - aucune animation si l'utilisateur a demandé de réduire les animations, ni
 *    hors navigateur (rendu serveur, tests) : la valeur exacte est affichée tout de suite ;
 *  - les lecteurs d'écran lisent uniquement la valeur finale.
 */

const DUREE_MS = 700;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function animationsActives(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (typeof window.requestAnimationFrame !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Courbe « sortie douce » : rapide au début, ralentit en arrivant. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** Valeur intermédiaire entre `from` et `to` à l'avancement `t` (0 → 1). */
export function valeurIntermediaire(from: number, to: number, t: number, decimals = 0): number {
  if (t >= 1) return to;
  const v = from + (to - from) * easeOutCubic(t);
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
}

export function useCountUp(value: number, decimals = 0): number {
  const cible = Number.isFinite(value) ? value : 0;
  const [affiche, setAffiche] = useState(cible);
  const precedent = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    const depart = precedent.current ?? 0;
    precedent.current = cible;
    if (!animationsActives() || depart === cible) {
      setAffiche(cible);
      return;
    }
    let frame = 0;
    const debut = performance.now();
    setAffiche(depart);
    const tick = (now: number) => {
      const t = (now - debut) / DUREE_MS;
      setAffiche(valeurIntermediaire(depart, cible, t, decimals));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setAffiche(cible);
    };
  }, [cible, decimals]);

  return affiche;
}
