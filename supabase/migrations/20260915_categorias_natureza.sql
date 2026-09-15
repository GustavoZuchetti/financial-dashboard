-- ═══════════════════════════════════════════════════════════════════════════
-- 20260915_categorias_natureza.sql
-- NATUREZA DAS CATEGORIAS — exclusão de transferências dos KPIs operacionais
--
-- Contexto: a auditoria de 11/09/2026 mediu, no consolidado das três entidades
-- (01/01 a 12/09):
--
--   Entradas · Transferência entre contas Facesign   R$ 2.931.277,98   34,7%
--   Entradas · Transferência FaceSign                R$   624.945,32    7,4%
--   Entradas · Transferência JB                      R$   164.000,00    1,9%
--                                                    ─────────────────────────
--                                                    R$ 3.720.223,30   44,0%
--
--   Saídas   · Transferência entre contas Facesign   R$ 2.769.783,77   36,5%
--   Saídas   · Transferência JB                      R$   590.799,58    7,8%
--                                                    ─────────────────────────
--                                                    R$ 3.360.583,35   44,3%
--
-- É o mesmo dinheiro circulando entre FACE, JAM e JB. Consolidação elimina
-- operação intragrupo; o sistema somava as duas pontas. O indicador mais
-- comprometido era o Índice de Cobertura: com ~44% do mesmo valor nos dois
-- lados, ele converge para 1,0 por construção matemática, não por desempenho.
--
-- ── Por que uma tabela e não uma lista fixa de nomes ────────────────────────
-- Requisito do Controller: "um cliente vai ter sua nomenclatura". Nenhuma lista
-- de nomes resolve. "Transferência entre contas Facesign" é específico desta
-- operação; outro tenant chamará de outra coisa.
--
-- ── Por que quatro naturezas e não um booleano ──────────────────────────────
-- As exclusões têm tratamentos contábeis distintos:
--   · transferencia_interna se ANULA no consolidado, mas é caixa real na
--     entidade isolada — a JAM efetivamente recebeu aquele dinheiro;
--   · aporte_socio é entrada de caixa legítima que não é receita;
--   · emprestimo é financiamento, não operação.
-- Um booleano "ignorar" misturaria os três e impediria análises futuras.
--
-- ⚠️ APLICAR NO SQL EDITOR DO SUPABASE. Idempotente.
-- Nada muda até o Controller classificar: o padrão é 'operacional' e a ausência
-- de linha também significa operacional.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.categorias_natureza (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Nome da categoria como vem da origem (Bling ou planilha), normalizado em
  -- minúsculas para que a comparação não dependa de caixa nem de acento digitado
  -- de formas diferentes ao longo do tempo.
  categoria       text not null,

  natureza        text not null default 'operacional'
                  check (natureza in ('operacional','transferencia_interna','aporte_socio','emprestimo')),

  observacao      text,
  definido_por    uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Classificação é ORG-WIDE, não por entidade: a mesma categoria tem a mesma
-- natureza em FACE, JAM e JB. Segue o padrão já adotado para o De-Para.
create unique index if not exists categorias_natureza_org_cat_uk
  on public.categorias_natureza (organization_id, lower(categoria));

create index if not exists categorias_natureza_org_ix
  on public.categorias_natureza (organization_id);

create or replace function public.categorias_natureza_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists categorias_natureza_touch_tg on public.categorias_natureza;
create trigger categorias_natureza_touch_tg
  before update on public.categorias_natureza
  for each row execute function public.categorias_natureza_touch();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.categorias_natureza enable row level security;

-- Varredura dinâmica antes de recriar: políticas legadas com nomes distintos
-- combinam permissivamente via OR — foi esse o vetor da falha cross-tenant
-- de 30/06.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'categorias_natureza'
  loop
    execute format('drop policy if exists %I on public.categorias_natureza', pol.policyname);
  end loop;
end $$;

create policy "access_categorias_natureza_select" on public.categorias_natureza
  for select using (organization_id = public.get_my_org_id());

-- Escrita só por administrador: reclassificar uma categoria altera todos os
-- KPIs operacionais da organização.
create policy "access_categorias_natureza_insert" on public.categorias_natureza
  for insert with check (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('org_admin','super_admin'));

create policy "access_categorias_natureza_update" on public.categorias_natureza
  for update using (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('org_admin','super_admin')
  ) with check (organization_id = public.get_my_org_id());

create policy "access_categorias_natureza_delete" on public.categorias_natureza
  for delete using (
    organization_id = public.get_my_org_id()
    and public.get_my_role() in ('org_admin','super_admin'));

-- ── Conferência pós-aplicação ───────────────────────────────────────────────
-- select categoria, natureza, definido_por, updated_at
--   from public.categorias_natureza order by natureza, categoria;
--
-- Categorias ainda sem classificação, por volume (a fila de trabalho):
-- select f.categoria, count(*) n, round(sum(abs(f.valor))::numeric,2) total
--   from public.fluxo_caixa f
--   left join public.categorias_natureza cn
--          on lower(cn.categoria) = lower(f.categoria)
--         and cn.organization_id = f.organization_id
--  where cn.id is null and f.categoria is not null
--  group by 1 order by 3 desc limit 40;
