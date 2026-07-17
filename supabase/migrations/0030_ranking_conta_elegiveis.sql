-- corretor_ranking contava só analises.status = 'concluida' — a página
-- individual do corretor (aba "Analisadas") conta qualquer status elegível
-- (concluida + pendente + processando + consolidada + falhou, tudo que não
-- é 'nao_elegivel'), então os dois números nunca batiam pro mesmo período
-- (ex: Aline ontem — 49 concluída vs 68 elegíveis: a diferença é pendente +
-- consolidada, que a lista simplesmente ignorava).
--
-- Passa a expor os dois números: `total_conversas` (toda conversa com
-- atividade no período, mesmo as que nunca vão entrar na fila por não
-- atingir o mínimo de mensagens) e `conversas_analisadas` (subconjunto
-- elegível — o mesmo critério da aba "Analisadas"). O dashboard mostra os
-- dois juntos: "71 conversas (64 analisadas)".
--
-- As médias por critério continuam vindo só das concluídas (avg() com
-- filtro), pra não puxar médias com score de conversas que não têm nota
-- ainda ou que foram consolidadas antes de ganhar um score de verdade.

-- create or replace não permite mudar o formato de retorno (nova coluna
-- conversas_analisadas) de uma função já existente — precisa dropar antes.
drop function if exists corretor_ranking(timestamptz, timestamptz);

create function corretor_ranking(data_inicio timestamptz, data_fim timestamptz)
returns table (
  corretor_id uuid,
  nome_crm text,
  ativo boolean,
  total_conversas bigint,
  conversas_analisadas bigint,
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
    count(distinct conv.id) as total_conversas,
    count(a.id) filter (where a.status <> 'nao_elegivel') as conversas_analisadas,
    avg(a.fluxo_score) filter (where a.status = 'concluida')::numeric(10, 2) as fluxo,
    avg(a.fluidez_score) filter (where a.status = 'concluida')::numeric(10, 2) as fluidez,
    avg(a.cta_score) filter (where a.status = 'concluida')::numeric(10, 2) as cta,
    avg(a.clareza_score) filter (where a.status = 'concluida')::numeric(10, 2) as clareza,
    avg(a.playbook_score) filter (where a.status = 'concluida')::numeric(10, 2) as playbook
  from corretores c
  left join conversas conv on conv.corretor_id = c.id
    and exists (
      select 1 from mensagens m
      where m.conversa_id = conv.id
        and m.enviada_em >= data_inicio
        and m.enviada_em < data_fim
    )
  left join analises a on a.conversa_id = conv.id
  group by c.id, c.nome_crm, c.ativo;
$$;
