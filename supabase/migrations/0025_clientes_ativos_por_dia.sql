-- Dashboard inicial mostrava "interações" (contagem bruta de mensagens) no
-- gráfico de tendência — troca pra "clientes" (leads distintos com pelo
-- menos 1 mensagem no período), que é uma métrica mais direta de volume de
-- atendimento. Conta distinct direto no banco (não dá pra fazer isso com
-- `count: exact` do PostgREST, que só conta linha, não valor distinto).

create or replace function clientes_ativos_no_periodo(data_inicio timestamptz, data_fim timestamptz)
returns bigint
language sql
stable
as $$
  select count(distinct c.lead_id)
  from mensagens m
  join conversas c on c.id = m.conversa_id
  where m.enviada_em >= data_inicio and m.enviada_em < data_fim;
$$;

grant execute on function clientes_ativos_no_periodo(timestamptz, timestamptz) to authenticated, anon;
