-- analyze-conversation-sweep: dispara o 1º passe (analyze-conversation-sync)
-- pra toda conversa marcada 'pendente' pelo sync-clint. Sem esse cron, nada
-- analisava sozinho — dependia de clique manual ou reprocessamento em lote.
--
-- ⚠️ Mesma pendência dos migrations 0006/0016: troque os placeholders abaixo
-- pelos valores reais do projeto antes de rodar.
--   <PROJECT_REF>   → Project Settings → API
--   <CRON_SECRET>   → o mesmo valor da env var CRON_SECRET

select cron.schedule(
  'analyze-conversation-sweep',
  '*/3 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/analyze-conversation-sweep',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para remover: select cron.unschedule('analyze-conversation-sweep');
