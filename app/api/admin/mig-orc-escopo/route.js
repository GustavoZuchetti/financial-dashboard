// TEMP: inspeciona e aplica a migração de escopo do orçamento. Remover após uso.
export const dynamic = 'force-dynamic'
export const maxDuration = 60
async function sql(t, q) {
  const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }) })
  const txt = await r.text(); let b; try { b = JSON.parse(txt) } catch { b = txt }
  return { status: r.status, body: b }
}
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== '9b85ee03e0922bc799e4afc9') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const t = process.env.SUPABASE_ACCESS_TOKEN
  if (!t) return Response.json({ error: 'SUPABASE_ACCESS_TOKEN ausente' })

  if (sp.get('apply') !== '1') {
    const cols = await sql(t, `select column_name, data_type, is_nullable from information_schema.columns where table_name='orcamentos' order by ordinal_position`)
    const pol  = await sql(t, `select polname, pg_get_expr(polqual, polrelid) as usando from pg_policy where polrelid='public.orcamentos'::regclass`)
    return Response.json({ modo: 'inspecao', colunas: cols.body, policies: pol.body })
  }

  const passos = []
  const run = async (nome, q) => { const r = await sql(t, q); passos.push({ nome, status: r.status, erro: r.status >= 400 ? r.body : null }) }

  await run('add escopo', `alter table public.orcamentos add column if not exists escopo text not null default 'entidade'`)
  await run('check escopo', `alter table public.orcamentos drop constraint if exists orcamentos_escopo_check;
    alter table public.orcamentos add constraint orcamentos_escopo_check check (escopo in ('entidade','consolidado'))`)
  await run('add organization_id', `alter table public.orcamentos add column if not exists organization_id uuid references public.organizations(id) on delete cascade`)
  await run('empresa_id nullable', `alter table public.orcamentos alter column empresa_id drop not null`)
  await run('indices unicidade', `drop index if exists orcamentos_unicidade;
    drop index if exists orcamentos_unicidade_entidade;
    drop index if exists orcamentos_unicidade_consolidado;
    create unique index orcamentos_unicidade_entidade on public.orcamentos (empresa_id, ano, mes, categoria, tipo, modulo) where escopo = 'entidade';
    create unique index orcamentos_unicidade_consolidado on public.orcamentos (organization_id, ano, mes, categoria, tipo, modulo) where escopo = 'consolidado'`)
  await run('integridade ids', `alter table public.orcamentos drop constraint if exists orcamentos_escopo_ids_check;
    alter table public.orcamentos add constraint orcamentos_escopo_ids_check check (
      (escopo = 'entidade' and empresa_id is not null) or (escopo = 'consolidado' and organization_id is not null))`)
  // RLS: recriar policy cobrindo consolidado (organization_id) e entidade (empresa_id)
  await run('rls', `do $$ declare c record; begin
      for c in select polname from pg_policy where polrelid='public.orcamentos'::regclass loop
        execute format('drop policy %I on public.orcamentos', c.polname); end loop; end $$;
    create policy orcamentos_all on public.orcamentos for all
      using (
        (empresa_id is not null and empresa_id in (select id from public.empresas where organization_id = public.get_my_org_id()))
        or (organization_id is not null and organization_id = public.get_my_org_id())
      )
      with check (
        (empresa_id is not null and empresa_id in (select id from public.empresas where organization_id = public.get_my_org_id()))
        or (organization_id is not null and organization_id = public.get_my_org_id())
      )`)
  await run('reload', `notify pgrst, 'reload schema'`)
  const cols = await sql(t, `select column_name, is_nullable from information_schema.columns where table_name='orcamentos' order by ordinal_position`)
  return Response.json({ modo: 'aplicado', passos, colunas_finais: cols.body })
}
