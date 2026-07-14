-- `corretor_ranking` filtrava por `analises.analisado_em` (quando o backend
-- terminou de rodar a IA) em vez da data real da conversa. Isso divergia
-- pouco no dia a dia (conversa é analisada minutos depois de acontecer),
-- mas quebra o filtro de período sempre que há reprocessamento em lote —
-- um resync completo (como o que fizemos hoje) analisa de uma vez conversas
-- de semanas atrás, todas ganhando `analisado_em` = hoje, e o filtro "hoje"
-- passa a mostrar conversas antigas. Troca pra `conversas.iniciada_em`
-- (data real do primeiro contato), que não muda quando a análise é refeita.

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
    and conv.iniciada_em >= data_inicio
    and conv.iniciada_em < data_fim
  left join analises a on a.conversa_id = conv.id
    and a.status = 'concluida'
  group by c.id, c.nome_crm, c.ativo;
$$;
