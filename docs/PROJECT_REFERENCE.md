# Facesign Financial Dashboard — Project Reference

> Arquivo de referência interna. Gustavo Garcia — Controller (Votuporanga-SP)
> Última atualização: 02/07/2026

---

## Repositório GitHub
- URL: https://github.com/GustavoZuchetti/financial-dashboard
- Branch: main
- Admin Portal: https://github.com/GustavoZuchetti/admin-portal
- Token: NÃO versionar no repositório (ver memória do Claude / gerenciador de senhas)

## Vercel
- Client: https://financial-dashboard-omega-six.vercel.app
- Admin:  https://admin-portal-coral-pi.vercel.app
- Dashboard: https://vercel.com/gugazuchetti-2198s-projects/financial-dashboard

## Supabase
- Project ID: wbrjdehmauaincgtcjrk
- URL: https://wbrjdehmauaincgtcjrk.supabase.co
- SQL Editor: https://supabase.com/dashboard/project/wbrjdehmauaincgtcjrk/sql/new
- Service Role: ver .env.local / variáveis da Vercel (não versionar)

## IDs Importantes
- empresa_id (FACE): 2cb67427-fa9f-4f64-a77f-543dca1a1ab7
- Usuario demo: demo@financialdashboard.com
- Usuario Gustavo: gustavo.zuchetti@facesign.in

## Stack
- Next.js 14.2.0 + Supabase + Vercel Hobby
- Recharts (graficos) | SheetJS/xlsx (import/export Excel) | Bling (ERP/CSV)
- Node 20 fixado via .nvmrc (Node 24 quebra o build na Vercel)

## Tabelas Supabase
- empresas (organization_id!), profiles, lancamentos, fluxo_caixa
- ciclo_financeiro (cols: id,empresa_id,ano,mes,pmr,pmp,pme,created_at)
- plano_contas, import_layouts, empresa_config, orcamentos, invites, org_settings

## REGRAS CRITICAS
1. Supabase REST limita 1000 rows/request — usar .range() ou while loop
2. ciclo_financeiro NAO tem colunas ciclo_operacional/ciclo_financeiro_valor
3. fluxo_caixa NAO tem coluna conta_id
4. cursor={false} em TODOS os <Tooltip> do Recharts
5. Vercel Hobby = serverless timeout 10s — evitar loops sequenciais em API routes
6. Build: createClient com URL placeholder (env vars ausentes no build); sem next/font/google
7. SEGURANCA: nunca consultar 'empresas' pelo client sem filtro de organização —
   usar /api/my-empresas (server-side, service role). Ver commit 38f616e e
   supabase/migrations/20260630_fix_rls_cross_org.sql
8. Filtro de entidades sempre via getSelectedEntidadeIds() (lib/supabase.js) —
   valida a seleção do localStorage contra as entidades da organização
9. Simbolos/ícones: usar components/SvgIcon.jsx — nunca emojis ou caracteres
   unicode de seta/caret na UI (▶ ▼ → ← ×)
10. Exportação Excel: usar lib/export-excel.js (downloadWorkbook/exportFilename)
