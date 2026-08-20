-- Mensagens do WhatsApp Business às vezes chegam do Clint com `content`
-- preenchido só com o prefixo de autoria do grupo/atendimento compartilhado
-- (ex: "*Victor Castro:* \n ") e nada de texto real depois. Como
-- `montarCamposMensagem` (sync-clint) só tratava `content: null` como "sem
-- texto", esse padrão passava direto como se fosse conteúdo genuíno do
-- corretor — e a IA analisava uma mensagem vazia como atendimento real.
-- Achado em produção: 652 casos só pro corretor "Victor Castro", 1000+ pro
-- corretor "ALINE", entre outros — volume relevante o suficiente pra
-- distorcer notas.
--
-- sync-clint já foi corrigido (PREFIXO_AUTOR_SEM_CONTEUDO) e
-- analysis-batch-submit/poll/analisar-conversa-unica já filtram esse
-- placeholder (EH_CONTEUDO_VAZIO, generalizado a partir do antigo
-- EH_TEMPLATE_VAZIO da migração 0037) em qualquer execução nova. Esta
-- migração só corrige o que já foi gravado/analisado:
--
-- 1. Normaliza o texto das mensagens já existentes pro mesmo placeholder que
--    sync-clint passaria a gerar hoje, mantendo o histórico consistente com
--    o que uma nova sincronização geraria.
-- 2. Reclassifica (mesmo critério da 0036/0037) qualquer análise que dependia
--    só desse "conteúdo fantasma" como não-elegível.

update mensagens
set texto = '[Conteúdo sem texto: TEXT]'
where remetente = 'corretor'
  and texto ~ '^\*[^*]+:\*\s*$';

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
      and m.texto !~ '^\[Conteúdo sem texto: .+\]$'
      and m.texto !~* 'sou a (l[ií]via|maria)[,.]?\s*assistente'
  );
