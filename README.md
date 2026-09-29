# Facesign Financial Dashboard

SaaS financeiro multi-tenant para relatórios executivos e de investidores — DRE, Fluxo
de Caixa, Ciclo Financeiro, Orçamento e Plano de Contas, alimentados pelo ERP Bling.

**Next.js 14 · Supabase · Vercel · Bling API v3**

## Documentação

Toda a documentação está em **[docs/](docs/README.md)**.

| | |
|---|---|
| [Visão geral](docs/01-visao-geral.md) | o que é, ambientes, stack |
| [Arquitetura](docs/02-arquitetura.md) | estrutura e fontes únicas de cálculo |
| [Regras de negócio](docs/04-regras-de-negocio.md) | **leitura obrigatória antes de mexer em cálculo** |
| [Operação](docs/08-operacao.md) | deploy, migrações, runbooks |
| [Pendências](docs/11-pendencias.md) | o que está aberto |

Sessões de desenvolvimento assistido: ver **[CLAUDE.md](CLAUDE.md)**.

## Desenvolvimento

```bash
nvm use                                        # Node 20 — obrigatório
npm install
npm run dev
```

Antes de mergear:

```bash
npm run build
for t in scripts/test-*.mjs; do node "$t"; done   # 15 suítes, 230 testes
```
