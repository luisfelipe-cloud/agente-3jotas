-- corretor_ranking filtrava por `conversas.iniciada_em` (data de CRIAÇÃO
-- daquele chat_id específico). Isso funcionava antes da consolidação por
-- lead (0021) existir — depois dela, a conversa "canônica" de um lead pode
-- ter sido criada semanas atrás e seguir recebendo toda a atividade nova por
-- meses; `iniciada_em` não muda, então o filtro de período passou a excluir
-- quase toda conversa realmente ativa no período escolhido (confirmado: 268
-- leads distintos com mensagem "ontem" via clientes_ativos_no_periodo, mas
-- só 17 conversas contadas aqui pra o mesmo período — a maior parte da
-- atividade real de ontem está em conversas canônicas criadas dias/semanas
-- antes).
--
-- Troca o filtro pra "teve pelo menos 1 mensagem no período" (mesmo
-- critério de `clientes_ativos_no_periodo`, 0025), que reflete atividade
-- real e não data de criação do primeiro chat_id do grupo consolidado.

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
    and exists (
      select 1 from mensagens m
      where m.conversa_id = conv.id
        and m.enviada_em >= data_inicio
        and m.enviada_em < data_fim
    )
  left join analises a on a.conversa_id = conv.id
    and a.status = 'concluida'
  group by c.id, c.nome_crm, c.ativo;
$$;
