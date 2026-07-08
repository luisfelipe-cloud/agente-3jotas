-- Schema inicial: Agente de Análise Qualitativa de Atendimentos
-- Executar via Supabase SQL Editor ou `supabase db push`

create extension if not exists "pgcrypto";

-- ==========================================================
-- Enums
-- ==========================================================

create type etapa_playbook as enum (
  'primeiro_contato',
  'envio_simulacao',
  'resultado_analise'
);

create type remetente_tipo as enum (
  'corretor',
  'lead'
);

create type analise_status as enum (
  'pendente',
  'processando',
  'concluida',
  'falhou'
);

-- ==========================================================
-- Corretores
-- ==========================================================

create table corretores (
  id          uuid primary key default gen_random_uuid(),
  nome_crm    text not null,
  crm_id      text unique,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ==========================================================
-- Leads
-- ==========================================================

create table leads (
  id          uuid primary key default gen_random_uuid(),
  telefone    text not null unique,
  nome_crm    text,
  crm_id      text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ==========================================================
-- Conversas
-- ==========================================================

create table conversas (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  corretor_id    uuid not null references corretores(id) on delete cascade,
  canal          text not null default 'whatsapp',
  etapa_playbook etapa_playbook,
  crm_conversa_id text unique,
  iniciada_em    timestamptz not null,
  finalizada_em  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_conversas_lead_id on conversas(lead_id);
create index idx_conversas_corretor_id on conversas(corretor_id);
create index idx_conversas_iniciada_em on conversas(iniciada_em);

-- ==========================================================
-- Mensagens
-- ==========================================================

create table mensagens (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references conversas(id) on delete cascade,
  remetente    remetente_tipo not null,
  texto        text not null,
  enviada_em   timestamptz not null,
  crm_mensagem_id text unique,
  created_at   timestamptz not null default now()
);

create index idx_mensagens_conversa_id on mensagens(conversa_id);
create index idx_mensagens_enviada_em on mensagens(enviada_em);

-- ==========================================================
-- Análises
-- ==========================================================

create table analises (
  id                    uuid primary key default gen_random_uuid(),
  conversa_id           uuid not null unique references conversas(id) on delete cascade,
  status                analise_status not null default 'pendente',

  fluxo_score           smallint,
  fluxo_evidencia       text,
  fluxo_justificativa   text,

  fluidez_score         smallint,
  fluidez_evidencia     text,
  fluidez_justificativa text,

  cta_score             smallint,
  cta_evidencia         text,
  cta_justificativa     text,

  clareza_score         smallint,
  clareza_evidencia     text,
  clareza_justificativa text,

  playbook_score        smallint,
  playbook_evidencia    text,
  playbook_justificativa text,

  justificativa_geral   text,
  modelo_usado          text,
  erro                  text,

  analisado_em          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_analises_status on analises(status);

-- ==========================================================
-- Playbooks (scripts versionados)
-- ==========================================================

create table playbooks (
  id             uuid primary key default gen_random_uuid(),
  etapa          etapa_playbook not null,
  versao         text not null,
  conteudo       text not null,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (etapa, versao)
);

-- garante um único playbook ativo por etapa
create unique index idx_playbooks_ativo_por_etapa
  on playbooks(etapa)
  where ativo;

-- ==========================================================
-- updated_at automático
-- ==========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_corretores_updated_at before update on corretores
  for each row execute function set_updated_at();

create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

create trigger trg_conversas_updated_at before update on conversas
  for each row execute function set_updated_at();

create trigger trg_analises_updated_at before update on analises
  for each row execute function set_updated_at();

-- ==========================================================
-- Row Level Security
--
-- Escrita (ingestão CRM/WhatsApp, motor de análise) é feita pelos
-- workers NestJS usando a service_role key, que ignora RLS por padrão.
-- As policies abaixo cobrem apenas o acesso via authenticated (dashboard).
-- Nenhuma policy é criada para "anon" — sem login, sem acesso.
-- ==========================================================

alter table corretores enable row level security;
alter table leads      enable row level security;
alter table conversas  enable row level security;
alter table mensagens  enable row level security;
alter table analises   enable row level security;
alter table playbooks  enable row level security;

create policy "authenticated pode ler corretores"
  on corretores for select
  to authenticated
  using (true);

create policy "authenticated pode ler leads"
  on leads for select
  to authenticated
  using (true);

create policy "authenticated pode ler conversas"
  on conversas for select
  to authenticated
  using (true);

create policy "authenticated pode ler mensagens"
  on mensagens for select
  to authenticated
  using (true);

create policy "authenticated pode ler analises"
  on analises for select
  to authenticated
  using (true);

create policy "authenticated pode ler playbooks"
  on playbooks for select
  to authenticated
  using (true);
