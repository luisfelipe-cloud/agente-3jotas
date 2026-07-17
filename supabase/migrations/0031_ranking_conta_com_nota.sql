-- A lista de corretores mostrava "X conversas (Y analisadas)" usando
-- conversas_analisadas (qualquer status elegível: concluida + pendente +
-- processando + consolidada + falhou) — mesma ambiguidade que já corrigimos
-- na aba da página individual (0030): "analisadas" parecia dizer "já tem
-- nota", mas incluía tudo que só está NA FILA. Renomeia a coluna pra
-- conversas_com_nota e restringe ao que de fato tem score (status =
-- 'concluida'), deixando explícito o que a UI já queria dizer.

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
  group by c.id, c.nome_crm, c.ativo;
$$;
