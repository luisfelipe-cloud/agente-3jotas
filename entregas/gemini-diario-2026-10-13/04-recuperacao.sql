-- Recuperação pontual autorizada em 13/10/2026. Requer as funções e RPCs novas.
-- Preserva autenticação nos comandos existentes; não imprime segredos.
-- Os jobs se removem quando terminam ou, no máximo, em 15/10 00:00 Fortaleza.
do $$
declare comando text; tarefa text;
begin
 select command into comando from cron.job where jobname='analysis-batch-submit';
 if comando is null or comando !~ $p$body\s*:=\s*'\{\}'::jsonb$p$ then raise exception 'Body do submit não reconhecido; não alterar'; end if;
 comando=regexp_replace(comando,$p$body\s*:=\s*'\{\}'::jsonb$p$,$p$body := '{"recuperacao":true,"diaInicio":"2026-10-08","diaFim":"2026-10-12"}'::jsonb$p$);
 tarefa=format($t$do $rec$ begin if now()>='2026-10-15T03:00:00Z'::timestamptz or not exists(select 1 from public.analises where dia between '2026-10-08' and '2026-10-12' and status in ('pendente','processando')) then perform cron.unschedule('gemini-recuperacao-analises-20261013'); else execute %L; end if; end $rec$;$t$,comando);
 perform cron.schedule('gemini-recuperacao-analises-20261013','*/2 * * * *',tarefa);
 perform cron.alter_job(job_id:=jobid,active:=true) from cron.job where jobname='gemini-recuperacao-analises-20261013';
 execute comando;
 select command into comando from cron.job where jobname='processar-midia-pendente';
 if comando ~ 'timeout_milliseconds' then
  comando=regexp_replace(comando,'timeout_milliseconds\s*:=\s*\d+','timeout_milliseconds := 120000');
 else
  if comando !~ '\)\s*;?\s*$' then raise exception 'Comando de mídia não reconhecido'; end if;
  comando=regexp_replace(comando,'\)\s*;?\s*$',', timeout_milliseconds := 120000);');
 end if;
 perform cron.alter_job(job_id:=jobid,command:=comando) from cron.job where jobname='processar-midia-pendente';
 if comando is null or comando !~ $p$body\s*:=\s*'\{\}'::jsonb$p$ then raise exception 'Body da mídia não reconhecido; não alterar'; end if;
 comando=regexp_replace(comando,$p$body\s*:=\s*'\{\}'::jsonb$p$,$p$body := '{"recuperacao":true,"diaInicio":"2026-10-09","diaFim":"2026-10-10"}'::jsonb$p$);
 tarefa=format($t$do $rec$ begin if now()>='2026-10-15T03:00:00Z'::timestamptz or not exists(select 1 from public.mensagens where not midia_descrita and enviada_em>='2026-10-09T03:00:00Z' and enviada_em<'2026-10-11T03:00:00Z') then perform cron.unschedule('gemini-recuperacao-midia-20261013'); else execute %L; end if; end $rec$;$t$,comando);
 perform cron.schedule('gemini-recuperacao-midia-20261013','*/2 * * * *',tarefa);
 perform cron.alter_job(job_id:=jobid,active:=true) from cron.job where jobname='gemini-recuperacao-midia-20261013';
 execute comando;
end $$;
