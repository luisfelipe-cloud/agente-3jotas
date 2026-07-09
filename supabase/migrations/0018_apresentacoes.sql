-- Apresentações geradas sob demanda por corretor + período (botão "Gerar
-- apresentação" na aba do corretor) — um HTML autocontido (estilo slide deck)
-- guardado inteiro na coluna `html`, servido depois via rota própria do
-- dashboard com Content-Type text/html.

create table apresentacoes (
  id           uuid primary key default gen_random_uuid(),
  corretor_id  uuid not null references corretores(id) on delete cascade,
  titulo       text not null,
  data_inicio  date not null,
  data_fim     date not null,
  html         text not null,
  criado_em    timestamptz not null default now()
);

create index idx_apresentacoes_corretor_id on apresentacoes(corretor_id);

alter table apresentacoes enable row level security;

create policy "authenticated pode ler apresentacoes"
  on apresentacoes for select
  to authenticated
  using (true);
