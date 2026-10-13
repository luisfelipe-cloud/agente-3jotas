create or replace function public.gemini_reservar_midia(p_limite integer default 15)
returns setof public.mensagens language plpgsql security invoker set search_path='' as $$
begin
 -- Expiração após envio não prova que o provedor não cobrou a inferência.
 insert into public.gemini_uso_midia(mensagem_id,tentativa,modelo,sucesso)
 select id,midia_tentativas,'gemini-2.5-flash',false from public.mensagens
 where not midia_descrita and midia_envio_iniciado and midia_lease_ate<=now()
 on conflict do nothing;
 update public.mensagens set midia_descrita=true,midia_erro='Envio expirado sem confirmação; reconciliar antes de repetir',
 texto='[Mídia indisponível — envio sem confirmação; conferir diagnóstico]',midia_lease=null,midia_lease_ate=null
 where not midia_descrita and midia_envio_iniciado and midia_lease_ate<=now();
 return query update public.mensagens m set midia_envio_iniciado=false,midia_lease=gen_random_uuid(),midia_lease_ate=now()+interval '3 minutes',midia_tentativas=m.midia_tentativas+1
 where m.id in (select id from public.mensagens where not midia_descrita and midia_tentativas<5
  and (midia_proxima_tentativa_em is null or midia_proxima_tentativa_em<=now())
  and (midia_lease_ate is null or midia_lease_ate<=now()) order by enviada_em for update skip locked limit least(greatest(p_limite,1),15)) returning m.*;
end $$;

create or replace function public.gemini_marcar_envio_midia(p_id uuid,p_lease uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.mensagens set midia_envio_iniciado=true
 where id=p_id and midia_lease=p_lease and midia_lease_ate>now() and not midia_envio_iniciado and not midia_descrita;
 return found;
end $$;
revoke execute on function public.gemini_marcar_envio_midia(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gemini_marcar_envio_midia(uuid,uuid) to service_role;

create or replace function public.gemini_finalizar_midia(p_id uuid,p_lease uuid,p_texto text,p_erro text,p_uso jsonb,p_modelo text,p_modelo_retornado text,p_repetir boolean default true)
returns boolean language plpgsql security invoker set search_path='' as $$
declare m public.mensagens; terminal boolean;
begin
 select * into m from public.mensagens where id=p_id and midia_lease=p_lease for update;
 if not found then return false; end if;
 terminal=p_texto is not null or m.midia_tentativas>=5 or not p_repetir;
 if p_uso is not null or m.midia_envio_iniciado then
  insert into public.gemini_uso_midia(mensagem_id,tentativa,modelo,modelo_retornado,uso,sucesso)
  values(m.id,m.midia_tentativas,p_modelo,p_modelo_retornado,p_uso,p_texto is not null) on conflict do nothing;
 end if;
 update public.mensagens set
  texto=coalesce(p_texto,case when terminal then '[Mídia indisponível — processamento falhou; conferir diagnóstico]' else texto end),
  midia_descrita=terminal,midia_erro=left(p_erro,500),midia_lease=null,midia_lease_ate=null,
  midia_proxima_tentativa_em=case when terminal then null else now()+make_interval(secs=>(300*power(2,m.midia_tentativas))::integer) end
 where id=m.id;
 return true;
end $$;

-- A alteração real de conteúdo (inclusive transcrição) marca a versão afetada.
create or replace function public.gemini_mensagem_alterada()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' or (new.texto,new.autor_crm_user_id,new.enviada_em,new.conversa_id) is distinct from
 (old.texto,old.autor_crm_user_id,old.enviada_em,old.conversa_id) then
  perform public.enfileirar_analise_diaria(new.conversa_id,(new.enviada_em at time zone 'America/Fortaleza')::date);
  if TG_OP='UPDATE' and (new.enviada_em,new.conversa_id) is distinct from (old.enviada_em,old.conversa_id) then
   perform public.enfileirar_analise_diaria(old.conversa_id,(old.enviada_em at time zone 'America/Fortaleza')::date);
  end if;
 end if;
 return new;
end $$;
create trigger gemini_mensagem_alterada after insert or update of texto,autor_crm_user_id,enviada_em,conversa_id on public.mensagens
 for each row execute function public.gemini_mensagem_alterada();

-- Mudanças do grupo/handoff invalidam os dias que tiveram conteúdo, inclusive os antigos.
create or replace function public.gemini_conversa_alterada()
returns trigger language plpgsql security invoker set search_path='' as $$
declare d date;
begin
 if (new.humano_assumiu_em,new.substituida_por_id) is distinct from (old.humano_assumiu_em,old.substituida_por_id) then
  for d in select distinct (m.enviada_em at time zone 'America/Fortaleza')::date from public.mensagens m
   join public.gemini_grupo(new.id) g on g.id=m.conversa_id loop
   perform public.enfileirar_analise_diaria(new.id,d);
  end loop;
 end if;
 return new;
end $$;
create trigger gemini_conversa_alterada after update of humano_assumiu_em,substituida_por_id on public.conversas
 for each row execute function public.gemini_conversa_alterada();
revoke execute on function public.gemini_conversa_alterada() from public,anon,authenticated;

-- Uso bruto permanece disponível; ausência de métricas não é zero tokens.
create view public.gemini_consumo_diario with (security_invoker=true) as
select (atualizada_em at time zone 'America/Fortaleza')::date as dia_consumo,modelo,modalidade,etapa,
 count(*) as execucoes,count(distinct conversa_id) as conversas,
 count(distinct (conversa_id,dia)) as pares_conversa_dia,
 count(*) filter(where estado='concluida') as concluidas,
 count(*) filter(where estado<>'concluida') as falhas_com_uso,
 sum(greatest(tentativas-1,0)) as retentativas,
 sum((uso->>'promptTokenCount')::bigint) as entrada,
 sum((uso->>'candidatesTokenCount')::bigint) as saida,
 sum((uso->>'thoughtsTokenCount')::bigint) as raciocinio,
 count(*) filter(where uso is null) as sem_metricas
from public.gemini_execucoes where estado='concluida' or uso is not null group by 1,2,3,4;
revoke all on public.gemini_consumo_diario from public,anon,authenticated;
grant select on public.gemini_consumo_diario to service_role;
revoke execute on function public.enfileirar_analise_diaria(uuid,date) from public,anon,authenticated;
grant execute on function public.enfileirar_analise_diaria(uuid,date) to service_role;
revoke execute on function public.gemini_reservar(uuid,date,text,text,text,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.gemini_reservar(uuid,date,text,text,text,text,jsonb,bigint) to service_role;
revoke execute on function public.gemini_marcar_envio(uuid[]) from public,anon,authenticated;
grant execute on function public.gemini_marcar_envio(uuid[]) to service_role;
revoke execute on function public.gemini_falhar(uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.gemini_falhar(uuid,text,boolean,boolean) to service_role;
revoke execute on function public.gemini_concluir(uuid,jsonb,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.gemini_concluir(uuid,jsonb,jsonb,text,boolean) to service_role;
revoke execute on function public.gemini_reservar_midia(integer) from public,anon,authenticated;
grant execute on function public.gemini_reservar_midia(integer) to service_role;
revoke execute on function public.gemini_finalizar_midia(uuid,uuid,text,text,jsonb,text,text,boolean) from public,anon,authenticated;
grant execute on function public.gemini_finalizar_midia(uuid,uuid,text,text,jsonb,text,text,boolean) to service_role;
revoke execute on function public.gemini_mensagem_alterada() from public,anon,authenticated;
create or replace function public.gemini_pendentes_revisao()
returns setof public.gemini_execucoes language sql security invoker set search_path='' as $$
 select e.* from public.gemini_execucoes e join public.analises a on a.conversa_id=e.conversa_id and a.dia=e.dia and a.conteudo_versao=e.versao
 where e.etapa='analise' and e.estado='concluida' and not exists(
  select 1 from public.gemini_execucoes r where r.conversa_id=e.conversa_id and r.dia=e.dia and r.input_hash=e.input_hash and r.etapa='revisao'
  and (r.estado<>'falhou' or r.tentativas>=3 or r.proxima_tentativa_em is null or r.proxima_tentativa_em>now()))
 order by e.atualizada_em limit 25;
$$;
revoke execute on function public.gemini_pendentes_revisao() from public,anon,authenticated;
grant execute on function public.gemini_pendentes_revisao() to service_role;

do $$ declare f record; begin for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'gemini_%' or p.proname='enfileirar_analise_diaria') loop execute format('revoke execute on function %s from public,anon,authenticated',f.assinatura); execute format('grant execute on function %s to service_role',f.assinatura); end loop; end $$;

