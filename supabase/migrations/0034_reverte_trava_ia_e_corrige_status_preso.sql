-- Reverte a exigência de mensagem de corretor humano (0032/0033) — decisão
-- do usuário depois de ver "não elegíveis" cheio de conversas que claramente
-- têm corretor humano. Investigando a fundo, o problema real não era a
-- trava em si: das 148 conversas marcadas 'nao_elegivel', 75 JÁ SÃO
-- elegíveis pela view agora mesmo (`elegivel = true`) — só ficaram com o
-- status desatualizado porque `analises.status` só é recalculado quando
-- chega mensagem nova na conversa (atualizarStatusAnalise, em sync-clint).
-- Toda vez que a regra de elegibilidade afrouxa (como em 0023, que tirou a
-- exigência de "2+ mensagens do lead"), quem já estava 'nao_elegivel' fica
-- preso pra sempre se não receber mensagem nova — só a 0011 tinha feito
-- esse tipo de correção retroativa, e só no sentido de apertar a regra,
-- nunca no de afrouxar.
--
-- Volta `elegivel` a exigir só 1+ mensagem no total (mesma regra da 0023),
-- mantém a coluna mensagens_corretor_humano (info ainda útil, sem gatilhar
-- elegibilidade) e reabre de vez qualquer 'nao_elegivel' que hoje já é
-- elegível — corrigindo tanto o backlog antigo quanto a mudança de regra
-- desta migração, sem depender de mensagem nova chegar.

create or replace view conversa_elegibilidade
  with (security_invoker = true)
as
select
  conv.id as conversa_id,
  count(m.id) as total_mensagens,
  count(m.id) filter (where m.remetente = 'lead') as mensagens_lead,
  (count(m.id) >= 1) as elegivel,
  count(m.id) filter (where m.remetente = 'corretor' and m.autor_crm_user_id is not null) as mensagens_corretor_humano
from conversas conv
left join mensagens m
  on m.conversa_id = conv.id
  and m.enviada_em > coalesce(conv.humano_assumiu_em, '-infinity'::timestamptz)
group by conv.id;

update analises a
set status = 'pendente'
where a.status = 'nao_elegivel'
  and (select elegivel from conversa_elegibilidade where conversa_id = a.conversa_id);
