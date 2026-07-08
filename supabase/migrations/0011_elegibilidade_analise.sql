-- Regra de elegibilidade pra análise: só vale a pena mandar pra IA quando a
-- conversa já teve interação mínima — 3+ mensagens no total, sendo 2+ do
-- lead (ou seja, não é só o corretor falando sozinho). Centralizado aqui
-- pra sync-clint, analyze-conversation-sync e o dashboard usarem a mesma regra.

create or replace view conversa_elegibilidade
  with (security_invoker = true)
as
select
  conv.id as conversa_id,
  count(m.id) as total_mensagens,
  count(m.id) filter (where m.remetente = 'lead') as mensagens_lead,
  (count(m.id) >= 3 and count(m.id) filter (where m.remetente = 'lead') >= 2) as elegivel
from conversas conv
left join mensagens m on m.conversa_id = conv.id
group by conv.id;

grant select on conversa_elegibilidade to authenticated, anon;

create or replace function elegivel_para_analise(p_conversa_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select elegivel from conversa_elegibilidade where conversa_id = p_conversa_id),
    false
  );
$$;

grant execute on function elegivel_para_analise(uuid) to authenticated, anon;

-- Corrige o status das análises já marcadas como pendente que, na verdade,
-- não atingem o mínimo de interação — viram "não elegível" até a conversa
-- evoluir (uma nova sincronização reavalia automaticamente).
update analises a
set status = 'nao_elegivel'
where a.status = 'pendente'
  and not elegivel_para_analise(a.conversa_id);
