-- Executar ANTES de publicar as Edge Functions do pacote.
-- Migração aditiva: nenhuma tabela de histórico é apagada.
-- O poll novo usa o registro de execuções; não abandone lotes do formato anterior.
do $$
begin
 if to_regclass('public.analise_batches') is not null then
  if exists(select 1 from public.analise_batches where status='in_progress') then
   raise exception 'Há batches legados ativos. Pause o submit e conclua/reconcilie esses batches com o poll anterior antes da migração';
  end if;
 end if;
end $$;
alter table public.analises add column if not exists conteudo_versao bigint not null default 0;
alter table public.analises add column if not exists proxima_tentativa_em timestamptz;
alter table public.mensagens add column if not exists midia_tentativas integer not null default 0;
alter table public.mensagens add column if not exists midia_proxima_tentativa_em timestamptz;
alter table public.mensagens add column if not exists midia_lease uuid;
alter table public.mensagens add column if not exists midia_lease_ate timestamptz;
alter table public.mensagens add column if not exists midia_erro text;
alter table public.mensagens add column if not exists midia_envio_iniciado boolean not null default false;
create table public.gemini_execucoes (
 id uuid primary key default gen_random_uuid(),
 conversa_id uuid not null references public.conversas(id) on delete cascade,
 dia date not null,
 input_hash text not null,
 etapa text not null check(etapa in ('analise','revisao')),
 modalidade text not null check(modalidade in ('batch','manual')),
 modelo text not null,
 modelo_retornado text,
 versao bigint not null,
 snapshot jsonb not null,
 resultado jsonb,
 uso jsonb,
 estado text not null default 'reservada' check(estado in ('reservada','enviando','submetida','concluida','falhou','incerta')),
 batch_externo text,
 reutilizacoes integer not null default 0,
 tentativas integer not null default 1,
 poll_tentativas integer not null default 0,
 erro text,
 proxima_tentativa_em timestamptz,
 criada_em timestamptz not null default now(),
 atualizada_em timestamptz not null default now(),
 lease_ate timestamptz not null default now()+interval '5 minutes',
 unique(conversa_id,dia,input_hash,etapa)
);
create index gemini_execucoes_ativas on public.gemini_execucoes(estado,atualizada_em);
create table public.gemini_uso_midia (
 mensagem_id uuid not null references public.mensagens(id) on delete cascade,
 tentativa integer not null,
 modelo text not null,
 modelo_retornado text,
 uso jsonb,
 sucesso boolean not null,
 criada_em timestamptz not null default now(),
 primary key(mensagem_id,tentativa)
);
alter table public.gemini_execucoes enable row level security;
alter table public.gemini_uso_midia enable row level security;
revoke all on public.gemini_execucoes, public.gemini_uso_midia from public,anon,authenticated;
grant all on public.gemini_execucoes, public.gemini_uso_midia to service_role;
-- Todas as RPCs operam com permissões do chamador e só service_role recebe EXECUTE.
create or replace function public.gemini_canonica(p_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare atual uuid:=p_id; proxima uuid; vistos uuid[]:='{}';
begin
 loop
  if atual=any(vistos) or cardinality(vistos)>=16 then raise exception 'Ciclo ou profundidade inválida na consolidação'; end if;
  vistos=array_append(vistos,atual);
  select substituida_por_id into proxima from public.conversas where id=atual;
  if not found then raise exception 'Conversa ausente'; end if;
  if proxima is null then return atual; end if;
  atual=proxima;
 end loop;
end $$;
create or replace function public.gemini_grupo(p_id uuid)
returns table(id uuid,humano_assumiu_em timestamptz,canonica_id uuid)
language sql security invoker set search_path='' as $$
 with recursive raiz as(select public.gemini_canonica(p_id) as id),
 grupo as(select c.id,c.humano_assumiu_em,array[c.id] as caminho from public.conversas c join raiz r on r.id=c.id
  union all select c.id,c.humano_assumiu_em,g.caminho||c.id from public.conversas c join grupo g on c.substituida_por_id=g.id
  where not c.id=any(g.caminho) and cardinality(g.caminho)<16)
 select g.id,g.humano_assumiu_em,r.id from grupo g cross join raiz r;
$$;
revoke execute on function public.gemini_canonica(uuid),public.gemini_grupo(uuid) from public,anon,authenticated;
grant execute on function public.gemini_canonica(uuid),public.gemini_grupo(uuid) to service_role;

create or replace function public.enfileirar_analise_diaria(p_conversa_id uuid,p_dia date)
returns void language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 v_id=public.gemini_canonica(p_conversa_id);
 if v_id is null then raise exception 'Conversa não encontrada'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id::text||p_dia::text,0));
 insert into public.analises(conversa_id,dia,status,conteudo_versao)
 values(v_id,p_dia,'pendente',1)
 on conflict(conversa_id,dia) do update set
  conteudo_versao=public.analises.conteudo_versao+1,
  status=case when public.analises.status='processando' then 'processando'::public.analise_status else 'pendente'::public.analise_status end,
  proxima_tentativa_em=null;
end $$;


do $$ declare f record; begin for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'gemini_%' or p.proname='enfileirar_analise_diaria') loop execute format('revoke execute on function %s from public,anon,authenticated',f.assinatura); execute format('grant execute on function %s to service_role',f.assinatura); end loop; end $$;
