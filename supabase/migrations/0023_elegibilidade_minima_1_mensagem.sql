-- Regra antiga exigia 3+ mensagens no total e 2+ do lead — na prática
-- deixava de fora conversas legítimas onde o corretor já mandou uma
-- mensagem de abertura/follow-up e o lead ainda não respondeu (ou respondeu
-- só uma vez). Mesmo 1 mensagem do corretor já é atendimento real e deve
-- ser avaliada — a regra passa a ser só "teve pelo menos 1 mensagem depois
-- do handoff da IA".

create or replace view conversa_elegibilidade
  with (security_invoker = true)
as
select
  conv.id as conversa_id,
  count(m.id) as total_mensagens,
  count(m.id) filter (where m.remetente = 'lead') as mensagens_lead,
  (count(m.id) >= 1) as elegivel
from conversas conv
left join mensagens m
  on m.conversa_id = conv.id
  and m.enviada_em > coalesce(conv.humano_assumiu_em, '-infinity'::timestamptz)
group by conv.id;
