create or replace function public.audit_stock_resume()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total_produits bigint;
  v_total_mouvements bigint;
  v_ecarts bigint;
  v_negatif bigint;
  v_orphelins bigint;
  v_sans_user bigint;
  v_doublons bigint;
begin
  if not (
    public.has_permission(auth.uid(), 'audit.voir')
    or public.has_permission(auth.uid(), 'stock.voir_audit')
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select count(*) into v_total_produits from public.produits where actif;
  select count(*) into v_total_mouvements from public.stock_mouvements;

  select count(*) into v_ecarts
  from public.produits p
  left join (
    select produit_id, sum(quantite) q from public.stocks_depots group by produit_id
  ) s on s.produit_id = p.produit_id
  where p.actif and coalesce(p.stock, 0) <> coalesce(s.q, 0);

  select count(*) into v_negatif from public.stocks_depots where quantite < 0;

  select count(*) into v_orphelins
  from public.stock_mouvements m
  left join public.produits p on p.produit_id = m.produit_id
  where p.produit_id is null;

  select count(*) into v_sans_user
  from public.stock_mouvements
  where user_id is null and created_at >= now() - interval '90 days';

  select count(*) into v_doublons from (
    select document_table, document_reference, produit_id
    from public.stock_mouvements
    where document_reference is not null
    group by 1, 2, 3
    having count(*) > 1
  ) d;

  return jsonb_build_object(
    'generated_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'total_produits', v_total_produits,
    'total_mouvements', v_total_mouvements,
    'ecarts_stock', v_ecarts,
    'stock_negatif', v_negatif,
    'mouvements_orphelins_produit', v_orphelins,
    'mouvements_sans_utilisateur_90j', v_sans_user,
    'doublons_document', v_doublons,
    'verdict', case
      when v_ecarts + v_negatif + v_orphelins + v_doublons = 0 then 'GO_PRODUCTION'
      else 'ANOMALIES_DETECTEES'
    end
  );
end;
$$;

grant execute on function public.audit_stock_resume() to authenticated;
grant execute on function public.audit_stock_resume() to service_role;