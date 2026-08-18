-- Permite logar corretores como usuários Supabase Auth normais (mesmo
-- fluxo dos admins hoje: criados manualmente no painel do Supabase).
-- Nulo pra corretores que só existem via sync do CRM e nunca logam no
-- dashboard. on delete set null: apagar o usuário auth não apaga o
-- corretor, só desvincula o login.
alter table corretores
  add column auth_user_id uuid unique references auth.users(id) on delete set null;
