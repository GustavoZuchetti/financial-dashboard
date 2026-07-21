// TEMP: destrava o cursor do cron da FACE (preso em fase:1/pagina:50)
export const dynamic = 'force-dynamic'
const KEY = 'PLACEHOLDER'
async function run(t,q){const r=await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query',{method:'POST',headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({query:q})});const x=await r.text();let b;try{b=JSON.parse(x)}catch{b=x}return{status:r.status,body:b}}
export async function GET(request){
  if(new URL(request.url).searchParams.get('key')!=='96d3141b8b0cabaecfe86d25')return Response.json({error:'unauthorized'},{status:401})
  const t=process.env.SUPABASE_ACCESS_TOKEN
  const antes=await run(t,"select empresa_id, cron_cursor, ultima_sync_cron from integracoes where modulo_fluxo_ativo=true")
  const upd=await run(t,"update integracoes set cron_cursor = '{\"fase\":0,\"pagina\":1}'::jsonb where cron_cursor is not null")
  const depois=await run(t,"select empresa_id, cron_cursor from integracoes where modulo_fluxo_ativo=true")
  return Response.json({ antes: antes.body, update_status: upd.status, depois: depois.body })
}
