-- ═══════════════════════════════════════════════════════════════════════════
-- 20260703_integracoes_api.sql — Integração via API (Bling)
-- Liberação por módulo no portal ADM; conexão OAuth por entidade;
-- conciliação por doc_ref (ID real do título no Bling)
-- ═══════════════════════════════════════════════════════════════════════════

-- Liberação (controlada pelo portal ADM) — separada por módulo
alter table public.organizations add column if not exists api_dre_liberado   boolean not null default false;
alter table public.organizations add column if not exists api_fluxo_liberado boolean not null default false;

-- Uma integração por entidade (empresa) da organização
create table if not exists public.integracoes (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  provedor            text not null default 'bling',
  client_id           text,
  client_secret       text,
  access_token        text,
  refresh_token       text,
  token_expira_em     timestamptz,
  modulo_dre_ativo    boolean not null default false,
  modulo_fluxo_ativo  boolean not null default false,
  ultima_sync         timestamptz,
  ultimo_resultado    jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, empresa_id, provedor)
);

-- Segurança: RLS ativo SEM políticas — a tabela guarda segredos (tokens,
-- client_secret) e só é acessível via service role nas rotas server-side
alter table public.integracoes enable row level security;

-- Conciliação: ID do título no provedor. Unique permite upsert idempotente
-- (múltiplos NULLs são permitidos — registros legados/via arquivo não colidem)
alter table public.fluxo_caixa add column if not exists doc_ref text;
alter table public.lancamentos add column if not exists doc_ref text;
create unique index if not exists uq_fc_doc_ref   on public.fluxo_caixa (doc_ref);
create unique index if not exists uq_lanc_doc_ref on public.lancamentos (doc_ref);
