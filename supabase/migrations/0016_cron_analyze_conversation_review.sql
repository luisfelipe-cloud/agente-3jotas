-- analyze-conversation-review: 2º passe do pipeline (revisão com contexto
-- completo da conversa), roda separado do 1º passe pra ter timeout próprio —
-- ver o comentário no topo de supabase/functions/analyze-conversation-review.
--
-- ⚠️ Mesma pendência do migration 0006: troque os placeholders abaixo pelos
-- valores reais do projeto antes de rodar.
--   <PROJECT_REF>   → Project Settings → API
--   <CRON_SECRET>   → o mesmo valor da env var CRON_SECRET

select cron.schedule(
  'analyze-conversation-review',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/analyze-conversation-review',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para remover: select cron.unschedule('analyze-conversation-review');
