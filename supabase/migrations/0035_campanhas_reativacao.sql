-- Reativação de base: o gestor sobe um CSV de leads perdidos (exportado do
-- Clint, já filtrado por lá — este sistema não tenta adivinhar o que é
-- "perdido"), o sistema separa por corretor (casando pelo nome que já vem
-- no CSV) e cria uma "campanha" do dia. Cada corretor recebe um link
-- público (sem login) que abre a lista dele pra preencher os campos de
-- ligação (11h/16h/18h, atendeu, deseja continuar) — mesmo formato da
-- planilha manual "LISTA BATERIA DE LIGAÇÃO" que a equipe já usava.

create table campanhas_reativacao (
  id           uuid primary key default gen_random_uuid(),
  corretor_id  uuid not null references corretores(id) on delete cascade,
  data         date not null,
  criado_em    timestamptz not null default now(),
  unique (corretor_id, data)
);

create table campanha_reativacao_leads (
  id                      uuid primary key default gen_random_uuid(),
  campanha_id             uuid not null references campanhas_reativacao(id) on delete cascade,
  nome                    text,
  telefone                text not null,
  status_importado        text,
  etapa_funil_importado   text,
  atendeu_11h             boolean not null default false,
  atendeu_16h             boolean not null default false,
  atendeu_18h             boolean not null default false,
  -- null = corretor ainda não respondeu essa pergunta pra esse lead.
  atendeu                 boolean,
  deseja_continuar        boolean,
  criado_em               timestamptz not null default now()
);

create index idx_campanha_reativacao_leads_campanha_id on campanha_reativacao_leads(campanha_id);
create index idx_campanhas_reativacao_corretor_id on campanhas_reativacao(corretor_id);

alter table campanhas_reativacao enable row level security;
alter table campanha_reativacao_leads enable row level security;

-- Mesmo padrão de apresentacoes (0018): API sempre lê/escreve via
-- createServiceClient (service-role, ignora RLS) — essa policy só cobre
-- acesso direto de um client autenticado no browser, que hoje não existe
-- pra essas tabelas, mas segue o padrão de segurança-em-camadas do projeto.
create policy "authenticated pode ler campanhas_reativacao"
  on campanhas_reativacao for select
  to authenticated
  using (true);

create policy "authenticated pode ler campanha_reativacao_leads"
  on campanha_reativacao_leads for select
  to authenticated
  using (true);
