-- Passa o pipeline de análise pra rodar via Gemini Batch API (50% mais
-- barato que a chamada síncrona) em vez de tempo real — a ideia agora é
-- processar o dia inteiro de uma vez de madrugada e ter o resultado pronto
-- de manhã, não análise instantânea a cada 3-5 minutos.
--
-- analysis-batch-submit/poll já existiam mas usavam a Anthropic Batches API
-- (Claude Sonnet, ~10x mais caro por token que o Gemini Flash) — o código
-- das duas Edge Functions passa a usar Gemini, cobrindo os dois passes
-- (1º passe "analise" + 2º passe "revisao", encadeados automaticamente
-- pelo poll quando o lote de análise termina).

alter table analise_batches rename column batch_id_anthropic to batch_id_externo;
alter table analise_batches add column if not exists tipo text not null default 'analise' check (tipo in ('analise', 'revisao'));

-- Desliga o caminho em tempo real — passa a ser só o batch noturno.
select cron.unschedule('analyze-conversation-sweep');
select cron.unschedule('analyze-conversation-review');
