-- Escopo do orçamento: por ENTIDADE (padrão) ou CONSOLIDADO (grupo/organização).
-- Grupos empresariais divergem: alguns orçam por empresa, outros um único
-- orçamento para o grupo. A tabela passa a suportar os dois.
alter table public.orcamentos add column if not exists escopo text not null default 'entidade';
alter table public.orcamentos drop constraint if exists orcamentos_escopo_check;
alter table public.orcamentos add constraint orcamentos_escopo_check check (escopo in ('entidade','consolidado'));

alter table public.orcamentos add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.orcamentos alter column empresa_id drop not null;

-- Unicidade separada por escopo (índices parciais)
drop index if exists orcamentos_unicidade;
drop index if exists orcamentos_unicidade_entidade;
drop index if exists orcamentos_unicidade_consolidado;
create unique index orcamentos_unicidade_entidade
  on public.orcamentos (empresa_id, ano, mes, categoria, tipo, modulo) where escopo = 'entidade';
create unique index orcamentos_unicidade_consolidado
  on public.orcamentos (organization_id, ano, mes, categoria, tipo, modulo) where escopo = 'consolidado';

-- Integridade: entidade exige empresa_id; consolidado exige organization_id
alter table public.orcamentos drop constraint if exists orcamentos_escopo_ids_check;
alter table public.orcamentos add constraint orcamentos_escopo_ids_check check (
  (escopo = 'entidade' and empresa_id is not null) or
  (escopo = 'consolidado' and organization_id is not null));

-- RLS: policy única cobrindo os dois escopos (as legadas sobrepunham via OR)
drop policy if exists orcamentos_escopo on public.orcamentos;
create policy orcamentos_escopo on public.orcamentos for all
  using (
    (empresa_id is not null and empresa_id in (select id from public.empresas where organization_id = public.get_my_org_id()))
    or (organization_id is not null and organization_id = public.get_my_org_id()))
  with check (
    (empresa_id is not null and empresa_id in (select id from public.empresas where organization_id = public.get_my_org_id()))
    or (organization_id is not null and organization_id = public.get_my_org_id()));
notify pgrst, 'reload schema';
