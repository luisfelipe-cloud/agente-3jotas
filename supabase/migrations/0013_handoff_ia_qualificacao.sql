-- Antes do corretor humano entrar na conversa, um agente de IA qualifica o
-- lead e termina com uma mensagem-resumo ("Aqui está um resumo das
-- informações que você me passou... um dos nossos corretores especialistas
-- vai assumir o atendimento..."). Tudo até essa mensagem (inclusive) é fase
-- da IA — não pode contar pra elegibilidade nem pra análise do corretor.
--
-- `humano_assumiu_em` guarda o timestamp dessa mensagem de resumo, detectada
-- pelo sync-clint. Enquanto for null, a conversa é tratada por inteiro
-- (nenhum handoff de IA identificado ainda).

alter table conversas add column if not exists humano_assumiu_em timestamptz;

create or replace view conversa_elegibilidade
  with (security_invoker = true)
as
select
  conv.id as conversa_id,
  count(m.id) as total_mensagens,
  count(m.id) filter (where m.remetente = 'lead') as mensagens_lead,
  (count(m.id) >= 3 and count(m.id) filter (where m.remetente = 'lead') >= 2) as elegivel
from conversas conv
left join mensagens m
  on m.conversa_id = conv.id
  and m.enviada_em > coalesce(conv.humano_assumiu_em, '-infinity'::timestamptz)
group by conv.id;
