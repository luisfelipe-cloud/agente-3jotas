-- sync-clint deixa de descrever mídia (áudio/imagem/documento) de forma
-- síncrona durante a ingestão — cada chamada Gemini por mensagem somava ao
-- tempo de execução e piorava o WORKER_RESOURCE_LIMIT que já vínhamos vendo
-- só com transcrição de áudio. A partir de agora, sync-clint grava a
-- mensagem na hora com um texto-placeholder e marca `midia_descrita =
-- false`; uma function separada (processar-midia-pendente, cron próprio)
-- descreve em lotes pequenos e controlados, sem competir pelo tempo do sync.

alter table mensagens
  add column if not exists midia_content_type text,
  add column if not exists midia_content_url text,
  add column if not exists midia_mime_type text,
  add column if not exists midia_nome text,
  add column if not exists midia_descrita boolean not null default true;

-- Índice parcial: só as linhas pendentes interessam pra fila de
-- processamento, e são sempre uma fração pequena do total.
create index if not exists idx_mensagens_midia_pendente
  on mensagens (enviada_em)
  where midia_descrita = false;
