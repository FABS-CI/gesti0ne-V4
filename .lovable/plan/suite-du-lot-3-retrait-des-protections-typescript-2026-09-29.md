# Suite du Lot 3 — retrait des protections TypeScript

## Objectif
Retirer progressivement les 28 directives `@ts-nocheck` restantes sans modifier les données métier ni les parcours existants.

## Étapes
1. Traiter d'abord les fichiers indépendants les plus simples et corriger leurs erreurs avec des contrôles explicites.
2. Vérifier le typage strict après chaque groupe, puis traiter les fonctions métier et les outils MCP.
3. Conserver uniquement la directive du fichier généré `routeTree.gen.ts`.
4. Contrôler la construction de l'application et mettre à jour la feuille de route avec le résultat exact.

## Contraintes techniques
- Aucun contournement par `any`, `never`, `@ts-ignore` ou assertion non sûre.
- Aucun changement de schéma ni de données métier.
- Réutiliser les types et sources de vérité existants.
- Si un fichier dépend réellement de types de base absents, documenter précisément ce blocage au lieu de masquer l'erreur.
