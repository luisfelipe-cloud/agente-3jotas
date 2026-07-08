-- Novo status para conversas que ainda não têm interação mínima suficiente
-- pra valer a pena mandar pra análise (regra: 3+ mensagens no total, sendo
-- 2+ do lead). Precisa ser uma migration separada da que passa a usar esse
-- valor — Postgres não permite usar um valor de enum recém-adicionado na
-- mesma transação em que ele foi criado.
alter type analise_status add value if not exists 'nao_elegivel';
