-- ═══════════════════════════════════════════════════════════════════════════
-- 20260812_saldos_abertura.sql
-- DATA DE CORTE E SALDO DE ABERTURA CERTIFICADO
--
-- Contexto: a auditoria de 13/08/2026 identificou três definições divergentes
-- de saldo de partida entre Visão Geral, Fluxo de Caixa e Gestão. A causa raiz
-- é que o saldo era composto somando TODO o histórico sobre um saldo_inicial
-- que já embute esse mesmo histórico — contagem dupla — e a base pré-2026 está
-- incompleta, produzindo um buraco artificial de ordem de milhões.
--
-- Esta migração introduz a âncora contábil: um saldo certificado numa data,
-- conferido contra extrato. Nada anterior à data de corte volta a ser somado.
--
-- SEMÂNTICA: data_corte é o saldo na ABERTURA daquele dia — os movimentos do
-- próprio dia ainda contam. "Saldo inicial para 07/2026" grava-se como
-- data_corte = 2026-07-01.
--
-- Várias linhas por empresa são esperadas e desejadas: a âncora vigente para
-- uma data é a de maior data_corte que não a ultrapassa. É assim que o
-- fechamento mensal se encaixa sem código novo — um INSERT por fechamento.
--
-- ⚠️ APLICAR NO SQL EDITOR DO SUPABASE. Execução idempotente.
-- ⚠️ NÃO altera nem remove empresa_config.saldo_inicial: a chave antiga
--    permanece intacta para permitir rollback imediato.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.saldos_abertura (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,

  -- Saldo na ABERTURA desta data
  data_corte      date not null,
  valor           numeric(14,2) not null,

  -- Procedência do número: o que o certifica
  origem          text not null default 'extrato_bancario'
                  check (origem in ('extrato_bancario', 'fechamento_mensal', 'saldo_migrado')),
  observacao      text,

  -- Trilha de auditoria: quem certificou e quando. NULO = não conferido ainda,
  -- e a interface deve exibir o saldo como PROVISÓRIO enquanto for nulo.
  conciliado_por  uuid references public.profiles(id) on delete set null,
  conciliado_em   timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Uma âncora por empresa por data. Recertificar = UPDATE, não linha duplicada.
create unique index if not exists saldos_abertura_empresa_data_uk
  on public.saldos_abertura (empresa_id, data_corte);

-- Resolução da âncora vigente: ORDER BY data_corte DESC LIMIT 1
create index if not exists saldos_abertura_lookup_ix
  on public.saldos_abertura (empresa_id, data_corte desc);

create index if not exists saldos_abertura_org_ix
  on public.saldos_abertura (organization_id);

-- ── updated_at automático ───────────────────────────────────────────────────
create or replace function public.saldos_abertura_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists saldos_abertura_touch_tg on public.saldos_abertura;
create trigger saldos_abertura_touch_tg
  before update on public.saldos_abertura
  for each row execute function public.saldos_abertura_touch();

-- ── Coerência: a empresa tem de pertencer à organização declarada ───────────
-- Sem isto, um INSERT com organization_id de outra org passaria pela RLS de
-- leitura da própria org e criaria uma âncora órfã, invisível ao dono real.
create or replace function public.saldos_abertura_valida_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare org_da_empresa uuid;
begin
  select e.organization_id into org_da_empresa
    from public.empresas e where e.id = new.empresa_id;
  if org_da_empresa is null then
    raise exception 'empresa % inexistente', new.empresa_id;
  end if;
  if new.organization_id is distinct from org_da_empresa then
    raise exception 'organization_id % nao confere com a organizacao da empresa (%)',
      new.organization_id, org_da_empresa;
  end if;
  return new;
end $$;

drop trigger if exists saldos_abertura_valida_org_tg on public.saldos_abertura;
create trigger saldos_abertura_valida_org_tg
  before insert or update on public.saldos_abertura
  for each row execute function public.saldos_abertura_valida_org();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.saldos_abertura enable row level security;

-- Remove TODAS as políticas da tabela por varredura dinâmica, independentemente
-- do nome. Políticas legadas com nomes distintos combinam-se permissivamente
-- via OR — foi exatamente esse o vetor da falha cross-tenant de 30/06.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'saldos_abertura'
  loop
    execute format('drop policy if exists %I on public.saldos_abertura', pol.policyname);
  end loop;
end $$;

-- Leitura: qualquer membro da organização
create policy "access_saldos_abertura_select" on public.saldos_abertura
  for select using (organization_id = public.get_my_org_id());

-- Escrita: apenas administradores. Saldo de abertura é parâmetro contábil —
-- alterá-lo remonta todo o caixa exibido a CEO e investidores.
create policy "access_saldos_abertura_insert" on public.saldos_abertura
  for insert with check (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('org_admin', 'super_admin')
  );

create policy "access_saldos_abertura_update" on public.saldos_abertura
  for update using (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('org_admin', 'super_admin')
  ) with check (organization_id = public.get_my_org_id());

create policy "access_saldos_abertura_delete" on public.saldos_abertura
  for delete using (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('org_admin', 'super_admin')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — preserva o comportamento atual sem certificar nada
--
-- Migra empresa_config.saldo_inicial para uma âncora em 2026-01-01, marcada
-- como 'saldo_migrado' e com conciliado_em NULO: a interface a exibirá como
-- PROVISÓRIA até o Controller conferi-la contra extrato.
--
-- A data 2026-01-01 replica a constante DATA_REFERENCIA_SALDO_INICIAL que
-- estava fixa no código. NÃO é uma afirmação de que esteja correta — é apenas
-- a continuidade do estado atual, agora visível e auditável em vez de oculta
-- numa constante.
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.saldos_abertura
  (organization_id, empresa_id, data_corte, valor, origem, observacao)
select
  e.organization_id,
  e.id,
  date '2026-01-01',
  round(nullif(regexp_replace(c.valor, '[^0-9.\-]', '', 'g'), '')::numeric, 2),
  'saldo_migrado',
  'Migrado de empresa_config.saldo_inicial em 12/08/2026. NAO CONFERIDO contra extrato.'
from public.empresa_config c
join public.empresas e on e.id = c.empresa_id
where c.chave = 'saldo_inicial'
  and nullif(regexp_replace(c.valor, '[^0-9.\-]', '', 'g'), '') is not null
on conflict (empresa_id, data_corte) do nothing;

-- ── Conferência pós-aplicação ───────────────────────────────────────────────
-- select e.nome, s.data_corte, s.valor, s.origem, s.conciliado_em
--   from public.saldos_abertura s
--   join public.empresas e on e.id = s.empresa_id
--  order by e.nome, s.data_corte;
