-- O critério "playbook" já avalia de forma agnóstica de etapa, juntando
-- TODOS os playbooks ativos como referência (ver buscarPlaybooksAtivos nas
-- Edge Functions) — não faz mais sentido travar em só 1 ativo por etapa.
-- Isso deixava, por exemplo, impossível ter dois scripts de abordagem
-- diferentes (um mais formal, outro mais direto) valendo ao mesmo tempo.

drop index if exists idx_playbooks_ativo_por_etapa;
