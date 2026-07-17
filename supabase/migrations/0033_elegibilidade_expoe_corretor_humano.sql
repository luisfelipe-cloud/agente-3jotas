-- Expõe quantas mensagens de corretor humano (autor_crm_user_id
-- preenchido) a conversa tem, além do total/mensagens_lead já existentes —
-- o dashboard usa isso pra decidir se mostra o botão "Analisar conversa"
-- numa conversa não elegível: só faz sentido forçar a análise manualmente
-- se um humano já escreveu algo (possível erro de elegibilidade em outro
-- lugar) — se for 100% IA, não tem o que analisar do corretor ainda.

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
  ) as elegivel,
  -- Coluna nova precisa ficar no fim — "create or replace view" não aceita
  -- reordenar/inserir no meio de colunas já existentes.
  count(m.id) filter (where m.remetente = 'corretor' and m.autor_crm_user_id is not null) as mensagens_corretor_humano
from conversas conv
left join mensagens m
  on m.conversa_id = conv.id
  and m.enviada_em > coalesce(conv.humano_assumiu_em, '-infinity'::timestamptz)
group by conv.id;
