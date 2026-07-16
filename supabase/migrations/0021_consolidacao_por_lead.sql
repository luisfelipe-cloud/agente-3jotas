-- Clint fecha o chat do lead e reabre com um crm_conversa_id novo quando ele
-- manda mensagem depois de um tempo (visto nos eventos REOPENED_BY_NEW_MESSAGE
-- da API) — hoje cada pedaço vira uma `conversa`/análise independente,
-- fragmentando o que na prática é uma única relação contínua com o lead.
-- Achado real: 18 de 186 leads já têm mais de uma `conversa`, sempre com o
-- mesmo corretor (nunca troca de responsável entre os pedaços).
--
-- Agrupamento por (lead_id, corretor_id) dentro de uma janela de 120 dias: a
-- conversa mais recente do grupo é a "canônica" (continua sendo analisada e
-- contando no ranking), as demais apontam `substituida_por_id` pra ela e
-- ganham status 'consolidada' em `analises` — nem "não elegível" (confuso,
-- soa como pouca interação) nem "concluída" (duplicaria a nota no ranking).

alter table conversas add column if not exists substituida_por_id uuid references conversas(id);

alter type analise_status add value if not exists 'consolidada';
