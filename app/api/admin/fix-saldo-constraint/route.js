export const dynamic = 'force-dynamic'
const KEY = '728a4cc1bc07680eee69fb25e9b2eb55'
async function run(t,q){const r=await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query',{method:'POST',headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({query:q})});const x=await r.text();let b;try{b=JSON.parse(x)}catch{b=x}return{status:r.status,body:b}}
export async function GET(request){
  if(new URL(request.url).searchParams.get('key')!==KEY)return Response.json({error:'unauthorized'},{status:401})
  const t=process.env.SUPABASE_ACCESS_TOKEN
  const out={}
  out.constraints_antes=await run(t,"select conname from pg_constraint where conrelid='public.empresa_config'::regclass and contype in ('u','p')")
  // Cria a unique(empresa_id,chave) se não existir — necessária p/ o onConflict do upsert
  out.criar=await run(t,"do $$ begin if not exists (select 1 from pg_constraint where conrelid='public.empresa_config'::regclass and contype='u' and conname='empresa_config_empresa_chave_uk') then alter table public.empresa_config add constraint empresa_config_empresa_chave_uk unique (empresa_id, chave); end if; end $$;")
  out.constraints_depois=await run(t,"select conname from pg_constraint where conrelid='public.empresa_config'::regclass and contype in ('u','p')")
  out.reload=await run(t,"notify pgrst, 'reload schema'")
  return Response.json(out)
}
