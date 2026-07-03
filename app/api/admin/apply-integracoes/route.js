export const dynamic = 'force-dynamic'
const KEY = '1c71dc8dff5cbf6e8422bac3ab98a84853d360f5'
const SQL = `-- ═══════════════════════════════════════════════════════════════════════════
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
`
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const run = async (q) => {
    const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }) })
    const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t }
    return { status: r.status, body: b }
  }
  const out = {}
  out.migracao = await run(SQL)
  out.conferencia = await run(
    "select 'integracoes_tabela' obj, count(*)::int n from information_schema.tables where table_name='integracoes' " +
    "union all select 'orgs_flags', count(*)::int from information_schema.columns where table_name='organizations' and column_name in ('api_dre_liberado','api_fluxo_liberado') " +
    "union all select 'indices_doc_ref', count(*)::int from pg_indexes where indexname in ('uq_fc_doc_ref','uq_lanc_doc_ref');")
  return Response.json(out)
}
