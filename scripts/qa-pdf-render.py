#!/usr/bin/env python3
"""QA automatisée de rendu des PDF FABS-CI.

Lance le générateur de chaque type de document dans un Chromium headless
pointé sur le dev server (http://localhost:8080), enregistre les PDF dans
tmp/pdf-qa/out/ et les images JPEG dans tmp/pdf-qa/shots/, et vérifie la
présence des éléments-clés (en-tête, colonnes Code et Désignation, référence imprimée
par le code-barres, pied de page société).

Prérequis : playwright (python), pdftoppm, pdftotext.
Usage     : python3 scripts/qa-pdf-render.py
"""
import asyncio
import base64
import subprocess
import sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("tmp/pdf-qa/out")
SHOTS = Path("tmp/pdf-qa/shots")
OUT.mkdir(parents=True, exist_ok=True)
SHOTS.mkdir(parents=True, exist_ok=True)

SAMPLE = {
    "reference": "FABS-QA-2026-0001",
    "date": "2026-06-30",
    "clientNom": "QA CLIENT",
    "clientTel": "+225 0102030405",
    "representant": "QA REP",
    "modePaiement": "Chèque",
    "lignes": [{
        "cycle": "SECOND CYCLE", "classe": "Tle D",
        "codeArticle": "FABS-QA1", "reference": "Test",
        "qte": 10, "qteCommandee": 10, "qteLivree": 10,
        "prixUnitaire": 4000, "montant": 40000,
    }],
    "totalVente": 40000, "remiseLigneTotal": 2000,
    "remiseGlobalePct": 10, "remiseGlobale": 3800,
    "montantHT": 34200, "totalTTC": 34200,
    "paye": 10000, "soldeDu": 24200,
}

CALLS = [
    ("BC", "generateBonCommandePDF"),
    ("PF", "generateProformaPDF"),
    ("FC", "generateFacturePDF"),
    ("BL", "generateBonLivraisonPDF"),
    ("BR", "generateBonRetourPDF"),
]

REQUIRED = ["EDITIONS FABS-CI", "CODE", "FABS-QA-2026-0001", "DÉSIGNATION"]

# Modules chargés avant les générations (voir le warm-up dans main).
WARMUP = [
    "/src/lib/pdf/fabsTemplates.ts",
    "/src/integrations/supabase/client.ts",
]


async def main() -> int:
    failures = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("PAGEERROR:", e))
        await page.goto("http://localhost:8080/auth", wait_until="domcontentloaded")
        # Warm-up : précharge les modules pour que Vite optimise leurs dépendances
        # avant les evaluate. Une dépendance découverte en cours de route (ex. le
        # client Supabase, chargé à la demande pour les factures et proformas)
        # provoque un rechargement complet qui détruit le contexte d'exécution.
        for module in WARMUP:
            for _ in range(3):
                try:
                    await page.evaluate(f"() => import('{module}').then(() => true, () => true)")
                    break
                except Exception:
                    await page.goto("http://localhost:8080/auth", wait_until="domcontentloaded")
        # Laisse passer un éventuel rechargement déclenché par l'optimisation.
        await page.wait_for_timeout(2000)
        await page.goto("http://localhost:8080/auth", wait_until="domcontentloaded")
        for code, fn in CALLS:
            try:
                args = "data, 'QA'" if fn == "generateAvoirPDF" else "data"
                script = f"""async (data) => {{
                        const m = await import('/src/lib/pdf/fabsTemplates.ts');
                        const blob = await m.{fn}({args});
                        const buf = new Uint8Array(await blob.arrayBuffer());
                        let bin = '';
                        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
                        return btoa(bin);
                    }}"""
                # Rechargement Vite pendant la génération : on recharge la page et
                # on recommence (au plus 3 essais) ; toute autre erreur est un échec.
                for essai in range(3):
                    try:
                        b64 = await page.evaluate(script, SAMPLE)
                        break
                    except Exception as e:
                        if "Execution context was destroyed" not in str(e) or essai == 2:
                            raise
                        await page.goto("http://localhost:8080/auth", wait_until="domcontentloaded")
                pdf = OUT / f"{code}.pdf"
                pdf.write_bytes(base64.b64decode(b64))
                subprocess.run(["pdftoppm", "-jpeg", "-r", "90", str(pdf), str(SHOTS / code)], check=True)
                txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout
                missing = [r for r in REQUIRED if r not in txt]
                if missing:
                    print(f"✗ {code} {fn}: éléments manquants → {', '.join(missing)}")
                    failures += 1
                else:
                    print(f"✓ {code} {fn}")
            except Exception as e:
                print(f"✗ {code} {fn}: {e}")
                failures += 1
        await b.close()
    print(f"\nScreenshots → {SHOTS}")
    # Lu par le workflow : le nombre attendu suit la liste CALLS.
    print(f"Documents : {len(CALLS) - failures}/{len(CALLS)}")
    return failures


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))