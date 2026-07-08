-- Suporte à análise em lote via Anthropic Message Batches API (50% mais barato
-- que chamadas síncronas) — usada pelo par de Edge Functions
-- analysis-batch-submit / analysis-batch-poll.

create table analise_batches (
  id                uuid primary key default gen_random_uuid(),
  batch_id_anthropic text not null unique, -- id retornado por POST /v1/messages/batches
  status            text not null default 'in_progress'
                      check (status in ('in_progress', 'ended', 'falhou')),
  total_requests    integer not null default 0,
  succeeded_count    integer,
  errored_count      integer,
  criado_em         timestamptz not null default now(),
  concluido_em      timestamptz,
  erro              text
);

-- Cada análise sabe a qual lote pertence, para o poll conseguir localizar
-- e atualizar as linhas certas quando o batch terminar (custom_id = conversa_id
-- já resolve o join, mas o batch_id facilita consultas/observabilidade).
alter table analises
  add column if not exists batch_id uuid references analise_batches(id);

create index idx_analises_batch_id on analises(batch_id);

alter table analise_batches enable row level security;

create policy "authenticated pode ler analise_batches"
  on analise_batches for select
  to authenticated
  using (true);
