-- A migration 0013 (handoff_ia_qualificacao) nunca chegou a ser aplicada em
-- produção — `conversas.humano_assumiu_em` não existia, o que fazia
-- sync-clint falhar em silêncio ao gravar o handoff, a view de elegibilidade
-- rodar a versão antiga (conta mensagem da IA de qualificação como interação
-- do corretor) e o 2º passe de revisão (analyze-conversation-review) sempre
-- cair no fallback "sem análise crua pra revisar" por erro de columa
-- inexistente. Esta migration reaplica o que faltou e adiciona o campo que
-- permite detectar o handoff pelo dado estruturado do Clint (`user_id` por
-- mensagem) em vez de só heurística de texto.

alter table conversas add column if not exists humano_assumiu_em timestamptz;

-- `null` = mensagem da IA de qualificação (Clint não usa conta própria pra
-- ela, então o único jeito de diferenciar é o `user_id` vir vazio); valor
-- preenchido = crm_id do corretor humano que efetivamente escreveu a
-- mensagem. Só faz sentido para remetente='corretor' (mensagens de lead não
-- têm essa noção).
alter table mensagens add column if not exists autor_crm_user_id text;

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
