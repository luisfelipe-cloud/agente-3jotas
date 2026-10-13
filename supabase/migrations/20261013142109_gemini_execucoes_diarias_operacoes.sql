create or replace function public.gemini_reservar(p_conversa_id uuid,p_dia date,p_hash text,p_etapa text,p_modelo text,p_modalidade text,p_snapshot jsonb,p_versao bigint)
returns setof public.gemini_execucoes language plpgsql security invoker set search_path='' as $$
declare e public.gemini_execucoes; v bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_conversa_id::text||p_dia::text,0));
 select conteudo_versao into v from public.analises where conversa_id=p_conversa_id and dia=p_dia for update;
 if v is distinct from p_versao or public.gemini_canonica(p_conversa_id)<>p_conversa_id then return; end if;
 -- Uma resposta incerta não autoriza reenviar uma inferência potencialmente paga.
 if exists(select 1 from public.gemini_execucoes where conversa_id=p_conversa_id and dia=p_dia and
  (estado in ('enviando','submetida','incerta') or (estado='reservada' and lease_ate>now()))) then return; end if;
 select * into e from public.gemini_execucoes where conversa_id=p_conversa_id and dia=p_dia and input_hash=p_hash and etapa=p_etapa for update;
 if found then
  if e.estado='concluida' then
   -- Mesmo input: reaplica o cache, sem nova inferência ou nova métrica de consumo.
   update public.gemini_execucoes set versao=p_versao,reutilizacoes=reutilizacoes+1
    where conversa_id=p_conversa_id and dia=p_dia and input_hash=p_hash and estado='concluida';
   perform public.gemini_concluir(e.id,e.resultado,e.uso,e.modelo_retornado,true);
   if p_etapa='analise' then
    select * into e from public.gemini_execucoes where conversa_id=p_conversa_id and dia=p_dia and input_hash=p_hash and etapa='revisao' and estado='concluida';
    if found then perform public.gemini_concluir(e.id,e.resultado,e.uso,e.modelo_retornado,true); end if;
   end if;
   return;
  end if;
  if e.estado='falhou' and (e.tentativas>=3 or e.proxima_tentativa_em is null or e.proxima_tentativa_em>now()) then return; end if;
  update public.gemini_execucoes set estado='reservada',tentativas=tentativas+1,versao=p_versao,
   snapshot=p_snapshot,modelo=p_modelo,modalidade=p_modalidade,lease_ate=now()+interval '5 minutes',atualizada_em=now(),erro=null
  where id=e.id returning * into e;
 else
  insert into public.gemini_execucoes(conversa_id,dia,input_hash,etapa,modelo,modalidade,snapshot,versao)
  values(p_conversa_id,p_dia,p_hash,p_etapa,p_modelo,p_modalidade,p_snapshot,p_versao) returning * into e;
 end if;
 update public.analises set status='processando',proxima_tentativa_em=null where conversa_id=p_conversa_id and dia=p_dia;
 return next e;
end $$;

create or replace function public.gemini_marcar_envio(p_ids uuid[])
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 update public.gemini_execucoes set estado='enviando',atualizada_em=now() where id=any(p_ids) and estado='reservada' and lease_ate>now();
 get diagnostics n=row_count;
 if n<>cardinality(p_ids) then raise exception 'Reserva expirada ou já utilizada'; end if;
 return n;
end $$;

create or replace function public.gemini_falhar(p_id uuid,p_erro text,p_incerta boolean,p_repetir boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare e public.gemini_execucoes; t timestamptz;
begin
 select * into e from public.gemini_execucoes where id=p_id;
 if not found then raise exception 'Execução ausente'; end if;
 perform pg_advisory_xact_lock(hashtextextended(e.conversa_id::text||e.dia::text,0));
 select * into e from public.gemini_execucoes where id=p_id for update;
 if e.estado='concluida' then return; end if;
 t=case when p_repetir and not p_incerta and e.tentativas<3 then now()+make_interval(secs=> (300*power(2,e.tentativas))::integer) else null end;
 update public.gemini_execucoes set estado=case when p_incerta then 'incerta' else 'falhou' end,
 erro=left(p_erro,500),proxima_tentativa_em=t,atualizada_em=now() where id=p_id;
 update public.analises set
 status=case when conteudo_versao<>e.versao or t is not null then 'pendente'::public.analise_status else 'falhou'::public.analise_status end,
 erro=case when conteudo_versao=e.versao then left(p_erro,500) else null end,
 proxima_tentativa_em=case when conteudo_versao=e.versao then t else null end
 where conversa_id=e.conversa_id and dia=e.dia;
end $$;

create or replace function public.gemini_concluir(p_id uuid,p_resultado jsonb,p_uso jsonb,p_modelo_retornado text,p_reaplicar boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare e public.gemini_execucoes; a public.analises; b public.analises_bruta; patch jsonb;
begin
 select * into e from public.gemini_execucoes where id=p_id;
 if not found then raise exception 'Execução ausente'; end if;
 perform pg_advisory_xact_lock(hashtextextended(e.conversa_id::text||e.dia::text,0));
 select * into e from public.gemini_execucoes where id=p_id for update;
 if e.estado='concluida' and not p_reaplicar then return false; end if;
 if e.estado<>'concluida' and e.estado not in ('enviando','submetida','incerta') then raise exception 'Estado não permite conclusão'; end if;
 if e.estado<>'concluida' then
  update public.gemini_execucoes set resultado=p_resultado,uso=p_uso,modelo_retornado=p_modelo_retornado,
  estado='concluida',atualizada_em=now(),erro=null where id=p_id;
 end if;
 select * into a from public.analises where conversa_id=e.conversa_id and dia=e.dia for update;
 if exists(select 1 from public.conversas where id=e.conversa_id and substituida_por_id is not null) then
  update public.analises set status='consolidada' where id=a.id;
  return false;
 end if;
 if a.conteudo_versao<>e.versao then
  update public.analises set status='pendente',proxima_tentativa_em=null where id=a.id;
  return false;
 end if;
 patch=jsonb_build_object('modelo_usado',coalesce(p_modelo_retornado,e.modelo),'erro',null);
 if e.etapa='analise' then
  patch=patch||jsonb_build_object('status','processando','justificativa_geral',p_resultado->>'justificativa_geral',
   'analisado_em',now(),'revisado',false,'revisado_em',null,'resumo_revisao',null);
 else
  patch=patch||jsonb_build_object('status','concluida','revisado',true,'revisado_em',now(),'resumo_revisao',p_resultado->>'resumo_revisao');
 end if;
 if p_resultado ? 'fluxo' then patch=patch||jsonb_build_object('fluxo_score',p_resultado->'fluxo'->'score','fluxo_evidencia',p_resultado->'fluxo'->>'evidencia','fluxo_justificativa',p_resultado->'fluxo'->>'justificativa'); end if;
 if p_resultado ? 'fluidez' then patch=patch||jsonb_build_object('fluidez_score',p_resultado->'fluidez'->'score','fluidez_evidencia',p_resultado->'fluidez'->>'evidencia','fluidez_justificativa',p_resultado->'fluidez'->>'justificativa'); end if;
 if p_resultado ? 'cta' then patch=patch||jsonb_build_object('cta_score',p_resultado->'cta'->'score','cta_evidencia',p_resultado->'cta'->>'evidencia','cta_justificativa',p_resultado->'cta'->>'justificativa'); end if;
 if p_resultado ? 'clareza' then patch=patch||jsonb_build_object('clareza_score',p_resultado->'clareza'->'score','clareza_evidencia',p_resultado->'clareza'->>'evidencia','clareza_justificativa',p_resultado->'clareza'->>'justificativa'); end if;
 if p_resultado ? 'playbook' then patch=patch||jsonb_build_object('playbook_score',p_resultado->'playbook'->'score','playbook_evidencia',p_resultado->'playbook'->>'evidencia','playbook_justificativa',p_resultado->'playbook'->>'justificativa'); end if;
 a=jsonb_populate_record(a,patch);
 update public.analises set
 status=a.status,
 modelo_usado=a.modelo_usado,
 erro=a.erro,
 justificativa_geral=a.justificativa_geral,
 analisado_em=a.analisado_em,
 revisado=a.revisado,
 revisado_em=a.revisado_em,
 resumo_revisao=a.resumo_revisao,
 fluxo_score=a.fluxo_score,
 fluxo_evidencia=a.fluxo_evidencia,
 fluxo_justificativa=a.fluxo_justificativa,
 fluidez_score=a.fluidez_score,
 fluidez_evidencia=a.fluidez_evidencia,
 fluidez_justificativa=a.fluidez_justificativa,
 cta_score=a.cta_score,
 cta_evidencia=a.cta_evidencia,
 cta_justificativa=a.cta_justificativa,
 clareza_score=a.clareza_score,
 clareza_evidencia=a.clareza_evidencia,
 clareza_justificativa=a.clareza_justificativa,
 playbook_score=a.playbook_score,
 playbook_evidencia=a.playbook_evidencia,
 playbook_justificativa=a.playbook_justificativa where id=a.id;
 if e.etapa='analise' then
  b=jsonb_populate_record(null::public.analises_bruta,to_jsonb(a)||jsonb_build_object('criado_em',now()));
  insert into public.analises_bruta select (b).* on conflict(conversa_id,dia) do update set
 modelo_usado=excluded.modelo_usado,
 justificativa_geral=excluded.justificativa_geral,
 fluxo_score=excluded.fluxo_score,
 fluxo_evidencia=excluded.fluxo_evidencia,
 fluxo_justificativa=excluded.fluxo_justificativa,
 fluidez_score=excluded.fluidez_score,
 fluidez_evidencia=excluded.fluidez_evidencia,
 fluidez_justificativa=excluded.fluidez_justificativa,
 cta_score=excluded.cta_score,
 cta_evidencia=excluded.cta_evidencia,
 cta_justificativa=excluded.cta_justificativa,
 clareza_score=excluded.clareza_score,
 clareza_evidencia=excluded.clareza_evidencia,
 clareza_justificativa=excluded.clareza_justificativa,
 playbook_score=excluded.playbook_score,
 playbook_evidencia=excluded.playbook_evidencia,
 playbook_justificativa=excluded.playbook_justificativa;
 end if;
 return true;
end $$;


do $$ declare f record; begin for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'gemini_%' or p.proname='enfileirar_analise_diaria') loop execute format('revoke execute on function %s from public,anon,authenticated',f.assinatura); execute format('grant execute on function %s to service_role',f.assinatura); end loop; end $$;

