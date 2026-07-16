-- ⚠️ ANTES DE RODAR: substitua <PROJECT_REF> e <CRON_SECRET> pelos valores
-- reais do projeto (mesmo aviso da 0006_pg_cron_schedules.sql — os outros
-- crons já tiveram esse placeholder esquecido sem substituição, causando um
-- dia inteiro sem nenhuma análise rodar).
--
-- processar-midia-pendente: descreve em lotes pequenos (via Gemini) as
-- mensagens de áudio/imagem/documento que sync-clint gravou com placeholder.
-- Roda a cada 5 minutos — mais frequente que sync-clint porque cada chamada
-- processa poucas mensagens (ver LOTE_MAXIMO na function) e não compete pelo
-- orçamento de tempo da ingestão.
select cron.schedule(
  'processar-midia-pendente',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/processar-midia-pendente',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
