-- Suporte à ingestão via Clint (CRM/WhatsApp): cursor de sincronização
-- incremental e ajuste no schema de leads, já que a API do Clint não expõe
-- telefone/nome no payload de chat/mensagem (só contact_id) — esses dados
-- serão preenchidos depois por um sync de contatos/corretores dedicado.

create table sync_cursors (
  chave      text primary key,
  valor      timestamptz not null default '1970-01-01T00:00:00Z',
  atualizado_em timestamptz not null default now()
);

alter table sync_cursors enable row level security;

create policy "authenticated pode ler sync_cursors"
  on sync_cursors for select
  to authenticated
  using (true);

-- telefone ainda não é conhecido no momento em que o lead é criado a partir
-- de um chat do Clint (só temos o contact_id) — passa a ser opcional.
alter table leads alter column telefone drop not null;
