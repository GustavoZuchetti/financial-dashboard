-- ═══════════════════════════════════════════════════════════════════════════
-- 20260630_fix_rls_cross_org.sql
-- CORREÇÃO DE SEGURANÇA (causa raiz) — Isolamento multi-organização via RLS
--
-- Contexto: o commit 38f616e (30/06/2026) fechou o vetor de exploração pela
-- INTERFACE, mas confirmou via teste de API que as políticas RLS originais
-- (baseadas apenas em empresas.user_id = auth.uid()) permitiam SELECT/INSERT
-- cross-tenant quando as empresas passaram a ser vinculadas por
-- organization_id. Esta migração corrige a nível de banco.
--
-- ⚠️ APLICAR MANUALMENTE no SQL Editor do Supabase e VALIDAR em seguida:
--    1. Logado como usuário da org A, tentar SELECT/INSERT com empresa_id
--       da org B via REST (anon key) — deve retornar 0 linhas / erro.
--    2. Fluxos normais (DRE, FC, Importação) devem continuar funcionando.
-- Se um script equivalente já foi aplicado em 30/06, este arquivo serve como
-- registro versionado — a execução é idempotente (DROP IF EXISTS + CREATE).
-- ═══════════════════════════════════════════════════════════════════════════

-- Função auxiliar: IDs de empresas acessíveis ao usuário autenticado
-- (via organization_id do profile, com fallback legado por user_id)
create or replace function public.user_empresa_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select e.id
  from public.empresas e
  join public.profiles p on p.organization_id = e.organization_id
  where p.id = auth.uid()
  union
  select e.id from public.empresas e where e.user_id = auth.uid()
$$;

revoke all on function public.user_empresa_ids() from public;
grant execute on function public.user_empresa_ids() to authenticated;

-- ── empresas: usuário só enxerga empresas da própria organização ────────────
drop policy if exists "Users can manage own empresas" on public.empresas;
drop policy if exists "empresas_org_isolation" on public.empresas;
create policy "empresas_org_isolation" on public.empresas
  for all
  using (id in (select public.user_empresa_ids()))
  with check (id in (select public.user_empresa_ids()));

-- ── lancamentos ──────────────────────────────────────────────────────────────
drop policy if exists "Users can manage lancamentos of own empresas" on public.lancamentos;
drop policy if exists "lancamentos_org_isolation" on public.lancamentos;
create policy "lancamentos_org_isolation" on public.lancamentos
  for all
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

-- ── fluxo_caixa ──────────────────────────────────────────────────────────────
drop policy if exists "Users can manage fluxo_caixa of own empresas" on public.fluxo_caixa;
drop policy if exists "fluxo_caixa_org_isolation" on public.fluxo_caixa;
create policy "fluxo_caixa_org_isolation" on public.fluxo_caixa
  for all
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

-- ── plano_contas ─────────────────────────────────────────────────────────────
drop policy if exists "Users can manage plano_contas of own empresas" on public.plano_contas;
drop policy if exists "plano_contas_org_isolation" on public.plano_contas;
create policy "plano_contas_org_isolation" on public.plano_contas
  for all
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

-- ── ciclo_financeiro ─────────────────────────────────────────────────────────
drop policy if exists "ciclo_org_isolation" on public.ciclo_financeiro;
create policy "ciclo_org_isolation" on public.ciclo_financeiro
  for all
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

-- ── empresa_config ───────────────────────────────────────────────────────────
drop policy if exists "empresa_config_org_isolation" on public.empresa_config;
create policy "empresa_config_org_isolation" on public.empresa_config
  for all
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

-- ── orcamentos ───────────────────────────────────────────────────────────────
drop policy if exists "Users can manage orcamentos of own empresas" on public.orcamentos;
drop policy if exists "orcamentos_org_isolation" on public.orcamentos;
create policy "orcamentos_org_isolation" on public.orcamentos
  for all
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

-- Observação: tabelas com políticas próprias já corrigidas em migrações
-- anteriores (ex.: 20260601_fix_ciclo_rls.sql, 20260601_org_settings.sql)
-- podem ter nomes de política distintos — os DROP IF EXISTS acima cobrem
-- os nomes conhecidos sem falhar caso não existam.
