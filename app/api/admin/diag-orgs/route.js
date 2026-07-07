export const dynamic = 'force-dynamic'
const KEY = '5bef5347cbbd64c019418ccc9a40304a7519a432'
async function run(token,q){const r=await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:q})});return r.json().catch(()=>null)}
export async function GET(request){
  if(new URL(request.url).searchParams.get('key')!==KEY)return Response.json({error:'unauthorized'},{status:401})
  const t=process.env.SUPABASE_ACCESS_TOKEN
  return Response.json({
    empresas: await run(t,"select id,nome,organization_id,user_id from empresas order by nome"),
    orgs: await run(t,"select id,nome from organizations order by nome"),
    orfas: await run(t,"select count(*) sem_org from empresas where organization_id is null"),
  })
}
