-- import_layouts: layouts de importação personalizados por empresa
create table if not exists public.import_layouts (
  id                  uuid        default uuid_generate_v4() primary key,
  empresa_id          uuid        references public.empresas(id) on delete cascade not null,
  nome                text        not null,
  descricao           text,
  separador           text        default ';',
  formato_data        text        default 'DD/MM/YYYY',
  linha_header        integer     default 1,
  colunas             jsonb       default '{}'::jsonb,
  tipo_regras         jsonb       default '[]'::jsonb,
  csv_headers_amostra text[],
  is_default          boolean     default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.import_layouts enable row level security;

create policy "Empresa gerencia seus layouts"
  on public.import_layouts for all
  using (empresa_id in (select id from public.empresas where user_id = auth.uid()));

create index idx_import_layouts_empresa on public.import_layouts(empresa_id);
