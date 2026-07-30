export const dynamic = 'force-dynamic'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== 'a86a1cd8326ab4ece4c85c37')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const t = process.env.SUPABASE_ACCESS_TOKEN
  const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method:'POST', headers:{ 'Authorization':'Bearer '+t, 'Content-Type':'application/json' },
    body: JSON.stringify({ query: `
      -- Título que não existe mais no Bling (excluído na origem): marca para
      -- não ser reprocessado a cada enriquecimento (404 permanente).
      alter table public.fluxo_caixa add column if not exists origem_ausente boolean not null default false;
      create index if not exists fluxo_caixa_origem_ausente_idx on public.fluxo_caixa (empresa_id) where origem_ausente;
      notify pgrst, 'reload schema';` }) })
  const body = await r.text()
  return Response.json({ status: r.status, body: body.slice(0, 300) })
}
