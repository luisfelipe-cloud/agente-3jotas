-- View de agregação para a aba Corretores do dashboard: total de conversas e
-- média de cada critério (só sobre análises concluídas). A média geral em si
-- é calculada no front (ignora critérios sem dado, em vez de contar como 0).

create or replace view corretor_ranking
  with (security_invoker = true)
as
select
  c.id as corretor_id,
  c.nome_crm,
  c.ativo,
  count(distinct conv.id) as total_conversas,
  avg(a.fluxo_score)::numeric(10, 2) as fluxo,
  avg(a.fluidez_score)::numeric(10, 2) as fluidez,
  avg(a.cta_score)::numeric(10, 2) as cta,
  avg(a.clareza_score)::numeric(10, 2) as clareza,
  avg(a.playbook_score)::numeric(10, 2) as playbook
from corretores c
left join conversas conv on conv.corretor_id = c.id
left join analises a on a.conversa_id = conv.id and a.status = 'concluida'
group by c.id, c.nome_crm, c.ativo;
