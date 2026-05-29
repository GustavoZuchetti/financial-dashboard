# Facesign Financial Dashboard — Project Reference

> Arquivo de referência interna. Gustavo Garcia — Controller (Votuporanga-SP)

---

## Repositório GitHub
- URL: https://github.com/GustavoZuchetti/financial-dashboard
- Branch: main
- Admin Portal: https://github.com/GustavoZuchetti/admin-portal
- Token: ver memoria do Claude (ghp_ + oMbgYzIoq5AOor4GDjOehS5z1Vtdu21buhlP)

## Vercel
- Client: https://financial-dashboard-omega-six.vercel.app
- Admin:  https://admin-portal-coral-pi.vercel.app
- Dashboard: https://vercel.com/gugazuchetti-2198s-projects/financial-dashboard

## Supabase
- Project ID: wbrjdehmauaincgtcjrk
- URL: https://wbrjdehmauaincgtcjrk.supabase.co
- SQL Editor: https://supabase.com/dashboard/project/wbrjdehmauaincgtcjrk/sql/new
- Service Role: ver .env.local (lya0lX7C_... sufixo: _u0oevESCE9Baak186aP9kZIxLWxyLC8-T8)

## IDs Importantes
- empresa_id (FACE): 2cb67427-fa9f-4f64-a77f-543dca1a1ab7
- Usuario demo: demo@financialdashboard.com
- Usuario Gustavo: gustavo.zuchetti@facesign.in

## Stack
- Next.js 14.2.0 + Supabase + Vercel Hobby
- Recharts (graficos) | Bling (ERP/CSV)

## Tabelas Supabase
- empresas, profiles, lancamentos, fluxo_caixa
- ciclo_financeiro (cols: id,empresa_id,ano,mes,pmr,pmp,pme,created_at)
- plano_contas, import_layouts, empresa_config, orcamento, invites

## REGRAS CRITICAS
1. Supabase REST limita 1000 rows/request — usar .range() ou while loop
2. ciclo_financeiro NAO tem colunas ciclo_operacional/ciclo_financeiro_valor
3. fluxo_caixa NAO tem coluna conta_id
4. cursor={false} em TODOS os <Tooltip> do Recharts
5. Vercel Hobby = serverless timeout 10s — evitar loops sequenciais em API routes
