-- Orçamento por módulo: DRE (existente) e Fluxo de Caixa (novo).
-- Linhas existentes recebem 'dre' (comportamento atual preservado).
alter table public.orcamentos add column if not exists modulo text not null default 'dre';
alter table public.orcamentos drop constraint if exists orcamentos_modulo_check;
alter table public.orcamentos add constraint orcamentos_modulo_check check (modulo in ('dre','fluxo'));

-- Unicidade passa a incluir o módulo (remove QUALQUER unique antiga das
-- colunas empresa/ano/mes/categoria/tipo, cujo nome pode variar)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.orcamentos'::regclass and contype = 'u'
  loop
    execute format('alter table public.orcamentos drop constraint %I', c.conname);
  end loop;
end $$;
drop index if exists orcamentos_unicidade;
create unique index orcamentos_unicidade
  on public.orcamentos (empresa_id, ano, mes, categoria, tipo, modulo);
notify pgrst, 'reload schema';
