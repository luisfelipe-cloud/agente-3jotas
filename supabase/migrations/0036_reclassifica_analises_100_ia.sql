-- Auditoria encontrou 12,5% das análises "concluídas" (75 de uma amostra de
-- 600) sendo 100% conduzidas pela IA de qualificação (Lívia/Maria) — o
-- corretor dono do chat nunca escreveu uma palavra, mas a conversa entrava
-- na fila normalmente (regra vigente desde 0034: 1+ mensagem, sem checar
-- quem escreveu) e a nota da IA acabava contando pro corretor.
--
-- analysis-batch-submit e analisar-conversa-unica passam a checar isso em
-- tempo real a cada execução (não é um status cacheado que pode ficar
-- desatualizado como em 0032 — essa checagem roda de novo toda noite, então
-- se um humano responder depois, a conversa entra no lote seguinte
-- normalmente). Esta migração só corrige retroativamente o que já foi
-- classificado errado.
--
-- Confere o GRUPO inteiro (conversa canônica + todas as substituídas por
-- ela via consolidação por lead, ver consolidarPorLead em sync-clint), não
-- só a linha da própria conversa — senão marcaria errado um caso onde o
-- humano respondeu num chat_id antigo já consolidado.

update analises a
set status = 'nao_elegivel',
    erro = '100% IA de qualificação (Lívia/Maria) — corretor ainda não engajou'
from conversas c
where a.conversa_id = c.id
  and a.status in ('pendente', 'processando', 'concluida')
  and not exists (
    select 1
    from mensagens m
    join conversas c2 on c2.id = m.conversa_id
    where (c2.id = c.id or c2.substituida_por_id = c.id)
      and m.remetente = 'corretor'
      and m.autor_crm_user_id is not null
  );
