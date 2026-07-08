-- Parâmetros configuráveis dos 5 critérios de avaliação, editáveis pela
-- aba Configurações do dashboard. Complementa `playbooks` (já criada em
-- 0001_init.sql) como fonte de configuração do motor de análise.

create type criterio_key as enum (
  'fluxo',
  'fluidez',
  'cta',
  'clareza',
  'playbook'
);

create table parametros_analise (
  id               uuid primary key default gen_random_uuid(),
  criterio         criterio_key not null unique,
  nota_maxima      smallint not null default 2 check (nota_maxima > 0),
  peso_percentual  smallint not null default 20 check (peso_percentual >= 0 and peso_percentual <= 100),
  descricao        text not null,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_parametros_analise_updated_at before update on parametros_analise
  for each row execute function set_updated_at();

insert into parametros_analise (criterio, nota_maxima, peso_percentual, descricao) values
  ('fluxo', 2, 20, 'Avaliar se o corretor tentou ligar e, somente se não atendeu, enviou mensagem conforme o script da etapa.'),
  ('fluidez', 2, 20, 'Avaliar se a troca de mensagens foi mantida sem deixar o cliente sem resposta no meio da conversa.'),
  ('cta', 2, 20, 'Avaliar se toda mensagem termina com uma pergunta direcionando o próximo passo, gerando compromisso de data/hora.'),
  ('clareza', 2, 20, 'Avaliar se a informação foi passada sem deixar dúvidas para o lead.'),
  ('playbook', 2, 20, 'Avaliar se o corretor seguiu a sequência de mensagens e follow-up do script correto para a etapa da conversa.');

alter table parametros_analise enable row level security;

create policy "authenticated pode ler parametros_analise"
  on parametros_analise for select
  to authenticated
  using (true);
