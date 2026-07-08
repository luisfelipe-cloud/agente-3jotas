-- Substitui a view estática corretor_ranking por uma função com parâmetros de
-- data — a aba Corretores passa a mostrar a média do período selecionado
-- (hoje por padrão) em vez da média acumulada desde sempre.
--
-- total_conversas aqui = conversas efetivamente analisadas dentro do período
-- (contagem de `analises`, não de `conversas`) — é a base usada nas médias.

drop view if exists corretor_ranking;

create or replace function corretor_ranking(data_inicio timestamptz, data_fim timestamptz)
returns table (
  corretor_id uuid,
  nome_crm text,
  ativo boolean,
  total_conversas bigint,
  fluxo numeric,
  fluidez numeric,
  cta numeric,
  clareza numeric,
  playbook numeric
)
language sql
stable
as $$
  select
    c.id as corretor_id,
    c.nome_crm,
    c.ativo,
    count(a.id) as total_conversas,
    avg(a.fluxo_score)::numeric(10, 2) as fluxo,
    avg(a.fluidez_score)::numeric(10, 2) as fluidez,
    avg(a.cta_score)::numeric(10, 2) as cta,
    avg(a.clareza_score)::numeric(10, 2) as clareza,
    avg(a.playbook_score)::numeric(10, 2) as playbook
  from corretores c
  left join conversas conv on conv.corretor_id = c.id
  left join analises a on a.conversa_id = conv.id
    and a.status = 'concluida'
    and a.analisado_em >= data_inicio
    and a.analisado_em < data_fim
  group by c.id, c.nome_crm, c.ativo;
$$;

grant execute on function corretor_ranking(timestamptz, timestamptz) to authenticated, anon;
