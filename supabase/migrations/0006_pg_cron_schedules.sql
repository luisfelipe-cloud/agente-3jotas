-- Agendamento dos crons via pg_cron + pg_net (chamada HTTP das Edge Functions
-- direto do Postgres — padrão recomendado pelo Supabase para cron jobs).
--
-- ⚠️ ANTES DE RODAR: substitua os dois placeholders abaixo pelos valores reais
-- do seu projeto (Project Settings → API, e o mesmo valor que você colocou em
-- CRON_SECRET nas Edge Functions):
--   <PROJECT_REF>   → ex: abcdefghijklmnop
--   <CRON_SECRET>   → o mesmo valor da env var CRON_SECRET
--
-- Não é seguro deixar o CRON_SECRET em texto puro num arquivo versionado em
-- produção — o ideal é buscar o valor do Vault do Supabase
-- (https://supabase.com/docs/guides/database/vault) em vez do literal abaixo.
-- Deixamos como placeholder aqui para ficar explícito o que precisa trocar.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- sync-clint: busca conversas/mensagens novas do Clint a cada 10 minutos.
select cron.schedule(
  'sync-clint',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-clint',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- analysis-batch-submit: envia as conversas pendentes para a Batch API uma
-- vez por noite (2h da manhã, horário do servidor do Postgres — geralmente UTC).
select cron.schedule(
  'analysis-batch-submit',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/analysis-batch-submit',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- analysis-batch-poll: verifica se algum lote terminou, a cada 10 minutos
-- (a maioria dos batches processa em menos de 1h, mas pode levar até 24h).
select cron.schedule(
  'analysis-batch-poll',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/analysis-batch-poll',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para inspecionar/depurar os jobs depois de aplicados:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Para remover um job: select cron.unschedule('sync-clint');
