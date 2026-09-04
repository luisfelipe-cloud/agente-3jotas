-- Passo 1/2 da migração pra permitir múltiplas análises por conversa, uma
-- por dia de atividade (hoje `analises.conversa_id` é unique — 1 análise por
-- conversa, sobrescrita a cada rodada noturna, o que impede o ranking de
-- corretores de fazer uma média real quando o período filtrado cobre vários
-- dias de atendimento da mesma conversa).
--
-- Este passo só adiciona a coluna `dia` (nullable) e faz o backfill —
-- NÃO troca a constraint de unicidade ainda. Isso mantém o sistema
-- funcionando 100% como está (Edge Functions continuam fazendo upsert por
-- conversa_id sozinho) enquanto valida em produção que o cálculo de `dia`
-- feito pelas Edge Functions (próximo deploy) está correto. A troca da
-- constraint vem numa migration separada, depois desse deploy.

alter table analises add column if not exists dia date;
alter table analises_bruta add column if not exists dia date;

-- Não temos o "dia da interação analisada" registrado pra linhas antigas
-- (o recorte por último-dia é lógica de aplicação, não gravada) —
-- analisado_em::date é a melhor aproximação disponível (data em que a
-- análise noturna rodou), caindo pra created_at/criado_em nas linhas sem
-- analisado_em (pendente/processando/nao_elegivel).
update analises
  set dia = coalesce(analisado_em::date, created_at::date)
  where dia is null;

update analises_bruta
  set dia = criado_em::date
  where dia is null;

alter table analises alter column dia set not null;
alter table analises_bruta alter column dia set not null;

-- Necessário pro filtro por período do corretor_ranking (a.dia >= ... and
-- a.dia < ...) não fazer sequential scan à medida que a tabela cresce
-- (N linhas por conversa agora, não mais 1).
create index if not exists idx_analises_dia on analises(dia);
