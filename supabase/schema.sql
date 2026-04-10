-- Financial Dashboard - Schema Supabase
-- Execute no SQL Editor do Supabase

-- Habilitar extensoes
create extension if not exists "uuid-ossp";

-- Tabela de Empresas
create table if not exists public.empresas (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  cnpj text,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade
);

alter table public.empresas enable row level security;
create policy "Users can manage own empresas" on public.empresas
  for all using (auth.uid() = user_id);

-- Tabela de Lancamentos (DRE)
create table if not exists public.lancamentos (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references public.empresas(id) on delete cascade,
  data date not null,
  descricao text,
  tipo text not null check (tipo in ('receita','custo','despesa')),
  valor numeric(15,2) not null default 0,
  conta_id uuid,
  categoria text,
  created_at timestamptz default now()
);

alter table public.lancamentos enable row level security;
create policy "Users can manage lancamentos of own empresas" on public.lancamentos
  for all using (
    empresa_id in (select id from public.empresas where user_id = auth.uid())
  );

create index idx_lancamentos_empresa_data on public.lancamentos(empresa_id, data);

-- Tabela de Fluxo de Caixa
create table if not exists public.fluxo_caixa (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references public.empresas(id) on delete cascade,
  data date not null,
  descricao text,
  tipo text not null check (tipo in ('entrada','saida')),
  valor numeric(15,2) not null default 0,
  categoria text,
  created_at timestamptz default now()
);

alter table public.fluxo_caixa enable row level security;
create policy "Users can manage fluxo_caixa of own empresas" on public.fluxo_caixa
  for all using (
    empresa_id in (select id from public.empresas where user_id = auth.uid())
  );

create index idx_fluxo_caixa_empresa_data on public.fluxo_caixa(empresa_id, data);

-- Tabela de Orcamentos
create table if not exists public.orcamentos (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references public.empresas(id) on delete cascade,
  ano integer not null,
  mes integer not null check (mes between 1 and 12),
  categoria text,
  tipo text check (tipo in ('receita','custo','despesa')),
  valor_orcado numeric(15,2) not null default 0,
  created_at timestamptz default now(),
  unique (empresa_id, ano, mes, categoria, tipo)
);

alter table public.orcamentos enable row level security;
create policy "Users can manage orcamentos of own empresas" on public.orcamentos
  for all using (
    empresa_id in (select id from public.empresas where user_id = auth.uid())
  );

-- Tabela de Ciclo Financeiro
create table if not exists public.ciclo_financeiro (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references public.empresas(id) on delete cascade,
  ano integer not null,
  mes integer not null check (mes between 1 and 12),
  pmp numeric(10,2) default 0,  -- Prazo Medio de Pagamento (dias)
  pme numeric(10,2) default 0,  -- Prazo Medio de Estoque (dias)
  pmr numeric(10,2) default 0,  -- Prazo Medio de Recebimento (dias)
  created_at timestamptz default now(),
  unique (empresa_id, ano, mes)
);

alter table public.ciclo_financeiro enable row level security;
create policy "Users can manage ciclo_financeiro of own empresas" on public.ciclo_financeiro
  for all using (
    empresa_id in (select id from public.empresas where user_id = auth.uid())
  );

-- Tabela de Plano de Contas
create table if not exists public.plano_contas (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references public.empresas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  tipo text not null check (tipo in ('receita','custo','despesa','ativo','passivo')),
  pai_id uuid references public.plano_contas(id),
  created_at timestamptz default now(),
  unique (empresa_id, codigo)
);

alter table public.plano_contas enable row level security;
create policy "Users can manage plano_contas of own empresas" on public.plano_contas
  for all using (
    empresa_id in (select id from public.empresas where user_id = auth.uid())
  );

-- Tabela de Importacoes Excel
create table if not exists public.importacoes (
  id uuid default uuid_generate_v4() primary key,
  empresa_id uuid references public.empresas(id) on delete cascade,
  arquivo_nome text,
  total_registros integer default 0,
  status text default 'processando' check (status in ('processando','concluido','erro')),
  created_at timestamptz default now()
);

alter table public.importacoes enable row level security;
create policy "Users can manage importacoes of own empresas" on public.importacoes
  for all using (
    empresa_id in (select id from public.empresas where user_id = auth.uid())
  );

-- Trigger para adicionar user_id na empresa automaticamente
create or replace function public.set_empresa_user_id()
returns trigger language plpgsql as $$
begin
  new.user_id = auth.uid();
  return new;
end;
$$;

create trigger empresa_user_id_trigger
  before insert on public.empresas
  for each row execute function public.set_empresa_user_id();

-- Dados de exemplo (opcional)
-- insert into public.empresas (nome, cnpj) values ('Empresa Exemplo', '00.000.000/0001-00');
