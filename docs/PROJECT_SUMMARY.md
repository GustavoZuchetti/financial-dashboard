# Facesign Financial Dashboard — Resumo Completo do Projeto

**Última atualização:** 02/07/2026 | **Usuário:** Gustavo Garcia, Controller | **Cidade:** Votuporanga-SP

---

## 1. O que é o sistema

SaaS financeiro multi-tenant construído para a Facesign (grupo FACE, JAM, JB).
Exibe DRE, Fluxo de Caixa, Ciclo Financeiro, Plano de Contas e Orçamento em tempo real,
com dados importados do ERP Bling via CSV. Consolidação multi-entidade por organization_id.

---

## 2. Arquitetura

```
Next.js 14 (App Router)  →  Supabase (PostgreSQL + Auth + RLS)  →  Vercel
```

- **Client:** financial-dashboard-omega-six.vercel.app
- **Repo:** github.com/GustavoZuchetti/financial-dashboard (branch: main)
- **Supabase project:** wbrjdehmauaincgtcjrk
- **empresa_id (FACE):** 2cb67427-fa9f-4f64-a77f-543dca1a1ab7

---

## 3. Estrutura de arquivos principais

```
app/dashboard/
  overview/OverviewContent.jsx       — KPIs gerais + gráfico evolução
  dre/
    page.jsx                         — DRE Visão Geral
    detalhado/page.jsx               — Drill-down + Exportação Excel (2 abas)
    analise/page.jsx                 — Análise gráfica
    comparativo/page.jsx             — Comparativo de períodos
  fluxo-caixa/
    page.jsx                         — Visão Geral (KPIs, gráfico, vencidos)
    gestao/page.jsx                  — Extrato bancário + CRUD + Exportação Excel
    analise|comparativo|projecao/    — Análises complementares
  ciclo-financeiro/page.jsx          — PMR, PMP, PME + Recalcular (consolida multi-entidade)
  plano-contas/page.jsx              — Plano de contas com edição de categorias
  plano-contas/auditoria/page.jsx    — Auditoria de classificação
  importacao/page.jsx                — Importação CSV Bling (empresas via /api/my-empresas)
  configuracoes/page.jsx             — Perfil, Empresas, Usuários, Identidade Visual, Admin
  orcamento/page.jsx                 — Orçamento vs Realizado

components/
  Sidebar.jsx                        — Menu com seletor multi-entidade + footer fixo
  SvgIcon.jsx                        — Biblioteca de ícones SVG (padrão do sistema)
  IdleTimeout.jsx                    — Logout por inatividade (45 min)
  Skeleton.jsx / Toast.jsx / OrgLogo.jsx / ThemeToggle.jsx

lib/
  supabase.js                        — Client + getSelectedEntidadeIds (validação de org)
  dre-calc.js                        — calcDRE, calcDREMap, DRE_LINES
  export-excel.js                    — downloadWorkbook/exportFilename (SheetJS)
  excel.js                           — Importação de planilhas
  org-context.js                     — Contexto de organização/roles

app/api/
  my-empresas/route.js               — Lista empresas da org (server-side, service role)
  auth/ | admin/ | invite/           — Fluxos de autenticação e administração
  recalcular-ciclo/route.js          — Popular ciclo_financeiro retroativamente

supabase/migrations/                 — Migrações SQL versionadas (aplicar no SQL Editor)
  20260630_fix_rls_cross_org.sql     — Isolamento RLS multi-organização (CRÍTICO)
```

---

## 4. Módulos e status

### DRE
- Visão Geral, Detalhado (drill 3 níveis com modal), Análise, Comparativo
- Impostos PIS/COFINS/ISS classificados como dedução (fix 19/jun)
- **Exportação Excel:** botão no header — aba "DRE" (linha→categoria) + aba "Lançamentos"
- Ícones SVG (chevrons/setas) — sem caracteres unicode

### Fluxo de Caixa
- Visão Geral com KPIs paginados e cards de vencidos
- **Gestão (ADM):** extrato bancário, saldo inicial/corrente, CRUD, exclusão em massa,
  **Exportação Excel** (busca paginada completa com filtros — abas Resumo + Extrato c/ saldo acumulado)
- Análise, Comparativo, Projeção

### Multi-entidade (jun/2026)
- Seletor multi-seleção no Sidebar; consolidação por organization_id
- getSelectedEntidadeIds() resolve e VALIDA a seleção contra a org (defesa em profundidade)
- Ciclo financeiro consolidado; plano de contas compartilhado

### Segurança (jun/2026)
- SECURITY FIX 38f616e: telas não expõem mais empresas de outras organizações
- Migração RLS versionada: supabase/migrations/20260630_fix_rls_cross_org.sql
  (⚠️ confirmar aplicação no banco — ver seção 7)
- Anti-escalada de role, logout por inatividade, esqueci-senha via admin SDK

### Importação
- CSV Bling (`;`, UTF-8 BOM); tipo derivado da conta vinculada
- Mensagens de contagem transparentes (toast × cards); reimportação parcial ou total

---

## 5. Regras críticas do código

| Regra | Detalhe |
|---|---|
| Paginação Supabase | Sempre `.range(pg*1000, (pg+1)*1000-1)` ou loop while |
| cursor Recharts | `cursor={false}` em TODOS os `<Tooltip>` |
| fluxo_caixa | Não tem coluna `conta_id` |
| ciclo_financeiro | Não tem `ciclo_operacional` nem `ciclo_financeiro_valor` |
| Vercel Hobby | Timeout 10s — upsert em lote, não loop sequencial |
| Build Vercel | Node 20 (.nvmrc); sem next/font/google; createClient com placeholder |
| Segurança | `empresas` só via /api/my-empresas; filtros via getSelectedEntidadeIds() |
| UI | Ícones via SvgIcon.jsx — proibido emoji/unicode (▶▼→←×) |
| Excel | lib/export-excel.js para toda exportação |

---

## 6. Histórico recente (jun–jul/2026)

| Período | Entrega |
|---|---|
| 02/jun | Pacote 6 fixes + ícones SVG substituindo emojis em todo o sistema |
| 10–12/jun | Recuperação de senha, admin global, crise de build resolvida (Node 20) |
| 11/jun | Idle timeout, error boundary, skeleton loading, debounce de períodos |
| 15/jun | Logo adaptativa por tema; fix org nula no login SPA |
| 19/jun | DRE: impostos como dedução + paginação de lançamentos |
| 21–25/jun | Plano de contas editável; sprint importação; sidebar reformulado |
| 26–30/jun | Multi-entidade (seletor + consolidação); SECURITY FIX cross-org; favicon |
| 02/jul | Exportação Excel (DRE Detalhado + FC Gestão); ícones SVG no DRE Detalhado; validação de seleção de entidades; migração RLS versionada |

---

## 7. Pendências / próximos passos

- [ ] **CRÍTICO — Confirmar aplicação da migração RLS** (20260630_fix_rls_cross_org.sql)
      no Supabase e validar com teste cross-org via REST
- [ ] Teste de regressão multi-entidade (FACE vs JAM vs JB) nos módulos DRE/FC/Ciclo
- [ ] Wire dos botões "Filtrar" e "Exportar" da FC Visão Geral (hoje sem onClick)
- [ ] Notificações de vencimentos no badge do sidebar
- [ ] Drill-down nos gráficos (clicar numa barra = ver lançamentos do mês)
- [ ] PME real: fixo em 0 (estoque não vem no CSV do Bling)
- [ ] Ciclo Financeiro: primeiro acesso exige clique em "Recalcular"

---

## 8. Como retomar em nova conversa

> "Estou trabalhando no projeto Facesign Financial Dashboard.
> Stack: Next.js 14 + Supabase + Vercel.
> Repo: github.com/GustavoZuchetti/financial-dashboard
> Referência completa em: docs/PROJECT_REFERENCE.md e docs/PROJECT_SUMMARY.md
> empresa_id: 2cb67427-fa9f-4f64-a77f-543dca1a1ab7
> Supabase: wbrjdehmauaincgtcjrk.supabase.co
> Client: financial-dashboard-omega-six.vercel.app
> Continue de onde paramos."
