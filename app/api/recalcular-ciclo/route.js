import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key') }

export async function POST(req) {
  const supabaseAdmin = getAdmin()
  try {
    // ─── Autenticação obrigatória ──────────────────────────────────
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    // ──────────────────────────────────────────────────────────────

    const { empresa_id } = await req.json()
    if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

    // Verificar se o usuário tem acesso à empresa solicitada
    const [{ data: profile }, { data: empresa }] = await Promise.all([
      supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).single(),
      supabaseAdmin.from('empresas').select('id,user_id,organization_id').eq('id', empresa_id).single(),
    ])

    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    const temAcesso =
      empresa.user_id === user.id ||
      (profile?.organization_id && empresa.organization_id === profile.organization_id)

    if (!temAcesso) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    // Buscar todos os registros com paginação
    let all = [], pg = 0
    while (true) {
      const { data: batch } = await supabaseAdmin
        .from('fluxo_caixa').select('tipo,data')
        .eq('empresa_id', empresa_id)
        .range(pg * 1000, (pg + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      all = all.concat(batch)
      if (batch.length < 1000) break
      pg++
    }

    if (!all.length) return NextResponse.json({ ok: true, meses: 0, total: 0 })

    // Agrupar por ano/mês
    const porMes = {}
    all.forEach(f => {
      if (!f.data) return
      const d = new Date(f.data + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      if (!porMes[key]) porMes[key] = { ano: d.getFullYear(), mes: d.getMonth() + 1, cnt_e: 0, cnt_s: 0 }
      if (f.tipo === 'entrada') porMes[key].cnt_e++
      else porMes[key].cnt_s++
    })

    const upsertPayload = Object.values(porMes).map(v => {
      const diasNoMes = new Date(v.ano, v.mes, 0).getDate()
      const pmr = v.cnt_e > 0 ? Math.round(diasNoMes / v.cnt_e) : 0
      const pmp = v.cnt_s > 0 ? Math.round(diasNoMes / v.cnt_s) : 0
      return { empresa_id, ano: v.ano, mes: v.mes, pmr, pmp, pme: 0 }
    })

    const { error } = await supabaseAdmin
      .from('ciclo_financeiro')
      .upsert(upsertPayload, { onConflict: 'empresa_id,ano,mes' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, meses: upsertPayload.length, total: all.length })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
