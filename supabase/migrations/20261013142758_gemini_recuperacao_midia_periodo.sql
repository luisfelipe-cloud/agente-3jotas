create or replace function public.gemini_reservar_midia_periodo(p_limite integer,p_inicio date,p_fim date)
returns setof public.mensagens language plpgsql security invoker set search_path='' as $$
begin
 if p_inicio is null or p_fim is null or p_inicio>p_fim or p_fim>=(now() at time zone 'America/Fortaleza')::date or p_fim-p_inicio>6 then raise exception 'Recuperação exige até sete dias encerrados'; end if;
 return query update public.mensagens m set midia_envio_iniciado=false,midia_lease=gen_random_uuid(),midia_lease_ate=now()+interval '3 minutes',midia_tentativas=m.midia_tentativas+1
 where m.id in (select id from public.mensagens where not midia_descrita and midia_tentativas<5 and (not midia_envio_iniciado or midia_lease is null)
  and enviada_em >= (p_inicio::timestamp at time zone 'America/Fortaleza') and enviada_em < ((p_fim+1)::timestamp at time zone 'America/Fortaleza')
  and (midia_proxima_tentativa_em is null or midia_proxima_tentativa_em<=now())
  and (midia_lease_ate is null or midia_lease_ate<=now()) order by enviada_em for update skip locked limit least(greatest(p_limite,1),15)) returning m.*;
end $$;

revoke execute on function public.gemini_reservar_midia_periodo(integer,date,date) from public,anon,authenticated;
grant execute on function public.gemini_reservar_midia_periodo(integer,date,date) to service_role;
