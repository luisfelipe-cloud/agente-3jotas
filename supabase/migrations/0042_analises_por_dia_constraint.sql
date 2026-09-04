-- Passo 2/2 da migração pra análises por dia — troca a unicidade de
-- `conversa_id` sozinho pra `(conversa_id, dia)`.
--
-- ATENÇÃO: só aplicar isto DEPOIS que analysis-batch-submit, analysis-batch-poll
-- e sync-clint já estiverem rodando a versão que grava `dia` corretamente em
-- todo upsert (ver migration 0040 e o deploy correspondente das Edge
-- Functions). Assim que este arquivo rodar, essas functions precisam estar
-- na versão que usa onConflict: "conversa_id,dia" — a versão antiga
-- (onConflict: "conversa_id") passa a falhar com erro de constraint
-- (sem corromper dado, só falha a escrita daquela execução).

do $$
declare
  nome_constraint text;
begin
  select conname into nome_constraint
  from pg_constraint
  where conrelid = 'analises'::regclass
    and contype = 'u'
    and array_length(conkey, 1) = 1
    and (select attname from pg_attribute where attrelid = 'analises'::regclass and attnum = conkey[1]) = 'conversa_id';

  if nome_constraint is not null then
    execute format('alter table analises drop constraint %I', nome_constraint);
  end if;
end $$;

alter table analises add constraint analises_conversa_id_dia_key unique (conversa_id, dia);

do $$
declare
  nome_pk text;
begin
  select conname into nome_pk
  from pg_constraint
  where conrelid = 'analises_bruta'::regclass
    and contype = 'p';

  if nome_pk is not null then
    execute format('alter table analises_bruta drop constraint %I', nome_pk);
  end if;
end $$;

alter table analises_bruta add constraint analises_bruta_pkey primary key (conversa_id, dia);
