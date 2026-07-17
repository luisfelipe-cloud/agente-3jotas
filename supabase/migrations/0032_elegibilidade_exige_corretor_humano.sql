-- conversa_elegibilidade (0023) considerava elegível qualquer conversa com
-- 1+ mensagem depois do handoff — mas quando `humano_assumiu_em` é null
-- (IA ainda não passou pro corretor), o join usa coalesce(...,
-- '-infinity'), então TODA mensagem da IA contava como "atendimento real" e
-- entrava na fila de análise, atribuindo a nota da conversa ao corretor
-- responsável pelo chat mesmo sem ele ter escrito uma palavra (achado ao
-- investigar a conversa de amariacelia969@gmail.com atribuída à Aline —
-- 100% IA, zero mensagem com autor_crm_user_id).
--
-- Passa a exigir também pelo menos 1 mensagem de corretor com
-- `autor_crm_user_id` preenchido (sinal estruturado de humano de verdade,
-- não a IA de qualificação) — sem isso, a conversa fica 'nao_elegivel' até
-- um humano de fato responder, e só entra na fila a partir daí.

create or replace view conversa_elegibilidade
  with (security_invoker = true)
as
select
  conv.id as conversa_id,
  count(m.id) as total_mensagens,
  count(m.id) filter (where m.remetente = 'lead') as mensagens_lead,
  (
    count(m.id) >= 1
    and count(m.id) filter (where m.remetente = 'corretor' and m.autor_crm_user_id is not null) >= 1
  ) as elegivel
from conversas conv
left join mensagens m
  on m.conversa_id = conv.id
  and m.enviada_em > coalesce(conv.humano_assumiu_em, '-infinity'::timestamptz)
group by conv.id;

-- Corrige na hora as análises já marcadas 'pendente'/'concluida' que, na
-- verdade, não têm nenhuma mensagem de corretor humano ainda — mesmo
-- espírito do ajuste feito em 0011 pra elegibilidade.
update analises a
set status = 'nao_elegivel'
where a.status in ('pendente', 'concluida')
  and not (select elegivel from conversa_elegibilidade where conversa_id = a.conversa_id);
