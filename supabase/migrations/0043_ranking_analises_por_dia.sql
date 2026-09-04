-- corretor_ranking agora agrega todas as linhas-dia de `analises` dentro do
-- período filtrado (não mais 1 linha por conversa) — é o que torna a média
-- do corretor uma média real dos dias de atendimento no período, em vez de
-- só a nota do dia mais recente analisado (ver migrations 0040/0042, que
-- introduziram a coluna `dia` e a chave composta (conversa_id, dia)).
--
-- `conversas_com_nota` passa, na prática, a contar análises-dia concluídas
-- no período, não mais conversas distintas — o rótulo exibido no dashboard
-- foi ajustado separadamente (ver dashboard/app/(app)/corretores/page.tsx).

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
    and a.dia < data_fim::date
  group by c.id, c.nome_crm, c.ativo;
$$;
