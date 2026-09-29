<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Les relevés clients calculent séparément paiements affectés et retours validés, puis les combinent une seule fois dans le solde, afin d'éviter tout double comptage.
- Un bon de retour dérivé d'une facture reprend les prix et remises effectifs de cette facture; le prix catalogue n'est qu'un secours pour les anciens retours sans facture.
- `sec_replace_user_scope` accepte un dépôt principal nullable; conserver cette sémantique et ne pas remplacer `null` par un dépôt arbitraire pour satisfaire le type généré.
