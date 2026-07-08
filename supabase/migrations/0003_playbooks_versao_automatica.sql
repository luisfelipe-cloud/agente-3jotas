-- A versão de um script de playbook deixa de ser um campo livre e passa a ser
-- calculada pela posição de criação dentro da etapa (1º cadastrado na etapa é
-- V1, o próximo V2, etc.) — decisão de produto: nunca editar versão manualmente.

alter table playbooks
  drop constraint if exists playbooks_etapa_versao_key,
  drop column if exists versao,
  add column if not exists updated_at timestamptz not null default now();

create trigger trg_playbooks_updated_at before update on playbooks
  for each row execute function set_updated_at();

-- View auxiliar: expõe a versão calculada (V1, V2...) sem precisar repetir a
-- lógica de numeração em toda query — usada pelo dashboard e, futuramente,
-- pelo motor de análise para montar o prompt com o script correto.
create or replace view playbooks_com_versao
  with (security_invoker = true)
as
select
  p.*,
  'V' || row_number() over (partition by p.etapa order by p.created_at) as versao
from playbooks p;
