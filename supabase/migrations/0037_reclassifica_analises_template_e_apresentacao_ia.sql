-- Duas correções no pipeline de análise (analysis-batch-submit,
-- analysis-batch-poll e analisar-conversa-unica passam a filtrar isso em
-- tempo real a cada execução — ver EH_TEMPLATE_VAZIO e EH_APRESENTACAO_IA
-- nos três arquivos):
--
-- 1. Mensagens de TEMPLATE (blast automático do WhatsApp Business, placeholder
--    fixo "[Conteúdo sem texto: TEMPLATE]" gravado por sync-clint) estavam
--    entrando na transcrição e contando como engajamento do corretor.
--
-- 2. A auto-apresentação canônica da IA de qualificação ("Sou a Lívia/Maria,
--    assistente da Três Jotas Imobiliária ✨") também estava contando como
--    mensagem do corretor quando, por algum motivo, vinha com
--    autor_crm_user_id preenchido. Importante: NÃO é um match solto de nome —
--    "Maria"/"Lívia" também são nomes reais de lead (confirmado em produção:
--    "Ana Livia", "Clivia" etc. recebem mensagens legítimas de corretor
--    humano cumprimentando pelo nome) — só a frase de auto-apresentação
--    completa é tratada como sinal de IA.
--
-- Esta migração só corrige retroativamente análises já classificadas com
-- base nesses dois pontos cegos; reavalia se, tirando TEMPLATE e
-- auto-apresentação da IA, ainda sobra alguma mensagem real de corretor
-- (mesmo critério/agrupamento de grupo consolidado da 0036).

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
      and m.texto !~ '^\[Conteúdo sem texto: TEMPLATE\]$'
      and m.texto !~* 'sou a (l[ií]via|maria)[,.]?\s*assistente'
  );
