export const dynamic = 'force-dynamic'
const KEY = 'CLEANUP'
async function run(t,q){const r=await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query',{method:'POST',headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({query:q})});const x=await r.text();let b;try{b=JSON.parse(x)}catch{b=x}return{status:r.status,body:b}}
export async function GET(request){
  if(new URL(request.url).searchParams.get('key')!=='658205901b76f83289f3029e')return Response.json({error:'unauthorized'},{status:401})
  const t=process.env.SUPABASE_ACCESS_TOKEN
  return Response.json(await run(t,"alter table public.empresa_config drop constraint if exists empresa_config_empresa_chave_uk; notify pgrst, 'reload schema'"))
}
