-- ═══════════════════════════════════════════════════════════════════════════
-- 20260916_natureza_plano_contas.sql
-- NATUREZA NO PLANO DE CONTAS — substitui a tabela categorias_natureza
--
-- Decisão do Controller (16/09/2026): a regra deve viver no Plano de Contas,
-- não numa tela separada. O plano já é o cadastro central das contas; manter
-- uma segunda tabela de classificação criava duas fontes de verdade que
-- poderiam divergir.
--
-- ── A verificação que fundamentou o desenho ────────────────────────────────
-- Levantamento de 16/09 sobre 130 categorias distintas em fluxo_caixa:
--   107 (82,3%) já existem no De-Para  → os nomes batem entre Bling e plano
--    23 (17,7%) sem mapeamento
--
-- A hipótese inicial era "sem mapeamento = não operacional". Os dados a
-- derrubaram: das 23, apenas 5 são de fato não-operacionais (Aporte de
-- Capital, Transferências, Retirada de Capital). As outras 18 são DESPESAS E
-- RECEITAS que faltam mapear:
--
--   Impostos sobre receitas      R$ 1.676.629
--   IRPJ e CSLL - Parcelamento   R$   320.404
--   Vale alimentação             R$   151.950
--   Dimensa                      R$    61.545
--   Rendimento de aplicação      R$    25.181
--
-- Inferir "não mapeado = fora do KPI" tiraria ~R$ 2,2 milhões de despesa
-- operacional dos indicadores, inflando o resultado. Ausência de mapeamento
-- significa "ainda não configurado" com muito mais frequência que "não é
-- operacional" — a mesma confusão corrigida no PR #18.
--
-- ── O desenho adotado ───────────────────────────────────────────────────────
-- `natureza` é coluna de plano_contas. A resolução é:
--     categoria → categoria_mappings → conta → plano_contas.natureza
-- Categoria sem conta resolve para 'operacional' (padrão seguro) e aparece
-- como pendência na tela, nunca é excluída em silêncio.
--
-- ⚠️ NÃO INTERFERE NO DRE. O DRE usa a coluna `tipo`; `natureza` é ortogonal
-- e nenhuma tela de DRE a consulta.
--
-- ⚠️ APLICAR NO SQL EDITOR DO SUPABASE. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.plano_contas
  add column if not exists natureza text not null default 'operacional';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'plano_contas_natureza_check'
       and conrelid = 'public.plano_contas'::regclass
  ) then
    alter table public.plano_contas
      add constraint plano_contas_natureza_check
      check (natureza in ('operacional','transferencia_interna','aporte_socio','emprestimo'));
  end if;
end $$;

comment on column public.plano_contas.natureza is
  'Define se a conta entra nos KPIs OPERACIONAIS. Ortogonal a `tipo`, que define a posicao no DRE — alterar natureza NAO afeta o DRE. operacional = entra; transferencia_interna, aporte_socio, emprestimo = fora dos indicadores de desempenho, mas seguem no saldo de caixa.';

create index if not exists plano_contas_natureza_ix
  on public.plano_contas (empresa_id, natureza)
  where natureza <> 'operacional';

-- ── Descontinuar categorias_natureza ────────────────────────────────────────
-- Criada em 20260915 e substituída antes de entrar em uso. Migra o que houver
-- para o plano de contas via De-Para, e só então remove — nenhuma decisão do
-- Controller se perde.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'categorias_natureza') then

    update public.plano_contas pc
       set natureza = cn.natureza
      from public.categorias_natureza cn
      join public.categoria_mappings cm
        on lower(cm.categoria_origem) = lower(cn.categoria)
     where cm.conta_id = pc.id
       and cn.natureza <> 'operacional'
       and pc.natureza = 'operacional';

    drop table public.categorias_natureza cascade;
  end if;
end $$;

-- ── Conferência pós-aplicação ───────────────────────────────────────────────
-- select nome, codigo, tipo, natureza from public.plano_contas
--  where natureza <> 'operacional' order by nome;
--
-- Categorias do fluxo sem conta vinculada (a fila de trabalho da tela):
-- select f.categoria, count(*) n, round(sum(abs(f.valor))::numeric,2) volume
--   from public.fluxo_caixa f
--   left join public.categoria_mappings m
--          on lower(m.categoria_origem) = lower(f.categoria)
--  where m.conta_id is null and f.categoria is not null
--  group by 1 order by 3 desc;
