-- Bug na migration 0043: comparava `a.dia < data_fim::date`, mas data_fim
-- já vem com hora 23:59:59.999 do dia final (ver dashboard/app/(app)/
-- corretores/page.tsx) — `data_fim::date` trunca pra esse mesmo dia, e `<`
-- exclui o próprio dia final da faixa. Um filtro De=03/09 Até=03/09
-- (data_fim::date = '2026-09-03') excluía TODAS as análises de 03/09,
-- deixando "0 com nota" mesmo com conversas concluídas naquele dia.
--
-- Corrigido pra `<=` — `a.dia` é o único lado dessa comparação que é `date`
-- puro (sem hora), então o dia final do filtro deve contar por inteiro.

drop function if exists corretor_ranking(timestamptz, timestamptz);

create function corretor_ranking(data_inicio timestamptz, data_fim timestamptz)
returns table (
  corretor_id uuid,
  nome_crm text,
  ativo boolean,
  total_conversas bigint,
  conversas_com_nota bigint,
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
    count(a.id) filter (where a.status = 'concluida') as conversas_com_nota,
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
    and a.dia >= data_inicio::date
    and a.dia <= data_fim::date
  group by c.id, c.nome_crm, c.ativo;
$$;
