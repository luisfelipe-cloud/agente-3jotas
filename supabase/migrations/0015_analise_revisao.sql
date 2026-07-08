-- Segundo estágio do pipeline de análise: depois da avaliação crua (critério
-- por critério, isolado), uma segunda passada relê a conversa inteira com o
-- resultado bruto em mãos e ajusta nota/evidência/justificativa onde o
-- julgamento rígido do primeiro passe perdeu nuance ou contexto (ironia,
-- recuperação tardia do corretor, gíria, tom mudando ao longo da conversa).
--
-- A revisão SUBSTITUI o que aparece no dashboard (sobrescreve as colunas de
-- `analises` in-place) — todo o resto do app já lê de `analises`, então não
-- precisa mudar nenhuma query existente. `analises_bruta` guarda o resultado
-- do primeiro passe intocado, só para auditoria/debug.

create table analises_bruta (
  conversa_id            uuid primary key references conversas(id) on delete cascade,

  fluxo_score            smallint,
  fluxo_evidencia        text,
  fluxo_justificativa    text,

  fluidez_score          smallint,
  fluidez_evidencia      text,
  fluidez_justificativa  text,

  cta_score              smallint,
  cta_evidencia          text,
  cta_justificativa      text,

  clareza_score          smallint,
  clareza_evidencia      text,
  clareza_justificativa  text,

  playbook_score         smallint,
  playbook_evidencia     text,
  playbook_justificativa text,

  justificativa_geral    text,
  modelo_usado           text,
  criado_em              timestamptz not null default now()
);

alter table analises_bruta enable row level security;

create policy "authenticated pode ler analises_bruta"
  on analises_bruta for select
  to authenticated
  using (true);

alter table analises add column if not exists revisado boolean not null default false;
alter table analises add column if not exists revisado_em timestamptz;
alter table analises add column if not exists resumo_revisao text;
