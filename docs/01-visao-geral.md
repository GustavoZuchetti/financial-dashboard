# 01 — Visão geral

## O que é

SaaS financeiro multi-tenant para relatórios executivos e de investidores. Construído
para o **Grupo Facesign** e desenhado para servir outros clientes com isolamento total
de dados entre organizações.

Exibe DRE, Fluxo de Caixa, Ciclo Financeiro, Orçamento e Plano de Contas, alimentados
pelo ERP **Bling** — por API (sincronização) e por arquivo (importação de planilha).

**Audiência dos números:** CEO, CTO e investidores. Isso define o padrão de rigor:
um KPI errado não é um bug de interface, é informação falsa entregue a quem decide.

## Organizações e entidades

| Organização | ID | Plano | Entidades |
|---|---|---|---|
| **Facesign Group** | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | Pro · Ativo | FACE, JAM, JB |
| Demo Corp | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | Pro · Trial | Demo Empresa Ltda |
| B3 AgroTech | — | — | isolada |

### As três entidades do Grupo Facesign

| Sigla | Razão social | `empresa_id` |
|---|---|---|
| **FACE** | Facesign Identidade Digital Biométrica Ltda | `2cb67427-fa9f-4f64-a77f-543dca1a1ab7` |
| **JAM** | Jam Serviços Financeiros Ltda | — |
| **JB** | JB Desenvolvimento Empresarial Ltda | — |

Movimentam dinheiro **entre si**. Essas transferências aparecem nos dois lados do fluxo
de caixa e precisam ser tratadas na consolidação — ver
[04 — Regras de negócio § Natureza](04-regras-de-negocio.md#7-natureza-das-contas).

## Ambientes

| Ambiente | URL |
|---|---|
| Portal do cliente | https://financial-dashboard-omega-six.vercel.app |
| Portal administrativo | https://admin-portal-coral-pi.vercel.app |
| Repositório (cliente) | https://github.com/GustavoZuchetti/financial-dashboard |
| Repositório (admin) | https://github.com/GustavoZuchetti/admin-portal |
| Supabase | projeto `wbrjdehmauaincgtcjrk` |
| SQL Editor | https://supabase.com/dashboard/project/wbrjdehmauaincgtcjrk/sql/new |
| Vercel | https://vercel.com/gugazuchetti-2198s-projects/financial-dashboard |

⚠️ **Os dois repositórios são públicos.** Ver [07 — Segurança](07-seguranca.md).

## Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.0 |
| UI | React | 18 |
| Gráficos | Recharts | 2.12 |
| Planilhas | SheetJS (`xlsx`) | 0.18.5 |
| Banco e autenticação | Supabase (PostgreSQL + Auth + RLS) | `@supabase/supabase-js` 2.105 |
| Hospedagem | Vercel, plano **Hobby** | — |
| Runtime | Node | **20** (fixado em `.nvmrc`) |
| ERP | Bling API v3 | OAuth 2.0 + **JWT** |

**Node 20 é obrigatório.** Node 24 quebra o build na Vercel.

## Usuários de referência

| Usuário | Papel |
|---|---|
| `demo@financialdashboard.com` | `super_admin` — usuário de teste e administração |
| Controller do Grupo Facesign | `org_admin` |

Papéis (verificado no código em 29/09): `super_admin` · `org_admin` · `user`.
Definidos em `profiles.role` e validados em `/api/admin/update-role`.

| Papel | Pode |
|---|---|
| `super_admin` | tudo, em qualquer organização — listar usuários, trocar papéis, redefinir senhas |
| `org_admin` | administrar a própria organização — integrações, classificação, logo |
| `user` | consultar |

O `super_admin` não pode remover o próprio papel — proteção contra bloqueio.
