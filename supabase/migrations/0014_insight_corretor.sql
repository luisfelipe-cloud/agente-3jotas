-- Insight de melhoria por corretor, gerado automaticamente pela IA sempre que
-- uma conversa dele é analisada (ver analyze-conversation-sync). Guarda só o
-- último resultado agregado — não é histórico, é sempre a leitura mais atual.

create table corretor_insights (
  corretor_id       uuid primary key references corretores(id) on delete cascade,
  texto             text not null,
  baseado_em_conversas smallint not null,
  gerado_em         timestamptz not null default now()
);

alter table corretor_insights enable row level security;

create policy "authenticated pode ler corretor_insights"
  on corretor_insights for select
  to authenticated
  using (true);
