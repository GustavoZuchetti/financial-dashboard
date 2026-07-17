// ═══════════════════════════════════════════════════════════════════
// lib/dre-calc.js — Cálculo centralizado do DRE
// Importado por todas as páginas de demonstrativos
// Garante que TODOS os números conversem entre si
// ═══════════════════════════════════════════════════════════════════

// Estrutura das linhas do DRE — mesma ordem em todas as telas
export const DRE_LINES = [
  { key:'receita_bruta',     label:'Receita Bruta',        tipos:['receita'],            sign:-1, isSubtotal:false, color:'var(--fs-success)' },
  { key:'deducoes',          label:'(-) Deduções',         tipos:['deducao'],            sign:+1, isSubtotal:false, color:'#f97316' },
  { key:'receita_liquida',   label:'= Receita Líquida',    tipos:[],                     sign: 0, isSubtotal:true,  color:'var(--fs-brand)' },
  { key:'custos_variaveis',  label:'(-) Custos Variáveis', tipos:['custo'],              sign:+1, isSubtotal:false, color:'var(--fs-danger)' },
  { key:'lucro_bruto',       label:'= Lucro Bruto',        tipos:[],                     sign: 0, isSubtotal:true,  color:'var(--fs-brand)' },
  { key:'despesas_fixas',    label:'(-) Despesas Fixas',   tipos:['despesa'],            sign:+1, isSubtotal:false, color:'var(--fs-warning)' },
  { key:'ebitda',            label:'= EBITDA',             tipos:[],                     sign: 0, isSubtotal:true,  color:'var(--fs-teal)' },
  { key:'impostos_lucro',    label:'(-) Impostos s/ Lucro',tipos:['imposto_lucro'],      sign:+1, isSubtotal:false, color:'#f97316' },
  { key:'receitas_fin',      label:'(+) Rec. Financeiras', tipos:['receita_financeira'], sign:-1, isSubtotal:false, color:'var(--fs-success)' },
  { key:'despesas_fin',      label:'(-) Desp. Financeiras',tipos:['despesa_financeira'], sign:+1, isSubtotal:false, color:'var(--fs-danger)' },
  { key:'resultado_liquido', label:'= Resultado Líquido',  tipos:[],                     sign: 0, isSubtotal:true,  color:'var(--fs-purple)' },
  { key:'investimentos',     label:'(-) Investimentos',    tipos:['investimento'],       sign:+1, isSubtotal:false, color:'var(--fs-text-4)' },
  { key:'resultado_final',   label:'= Resultado Final',    tipos:[],                     sign: 0, isSubtotal:true,  color:'var(--fs-brand)' },
]

// ─── Cálculo canônico do DRE ───────────────────────────────────────
// ÚNICA fonte de verdade — todos os demonstrativos usam esta função
export function calcDRE(lancamentos = []) {
  const sum = (tipos) =>
    lancamentos.filter(l => tipos.includes(l.tipo)).reduce((a, c) => a + Number(c.valor), 0)

  const rb   = sum(['receita'])
  const ded  = sum(['deducao'])
  const rl   = rb - ded
  const cv   = sum(['custo'])
  const lb   = rl - cv
  const df   = sum(['despesa'])
  const ebt  = lb - df
  const imp  = sum(['imposto_lucro'])
  const rf   = sum(['receita_financeira'])
  const dfin = sum(['despesa_financeira'])
  const resL = ebt - imp + rf - dfin
  const inv  = sum(['investimento'])
  const resF = resL - inv

  return { rb, ded, rl, cv, lb, df, ebt, imp, rf, dfin, resL, inv, resF }
}

// ─── Mapeamento key → valor calculado ─────────────────────────────
export function calcDREMap(lancamentos = []) {
  const v = calcDRE(lancamentos)
  return {
    receita_bruta:     v.rb,
    deducoes:         -v.ded,
    receita_liquida:   v.rl,
    custos_variaveis: -v.cv,
    lucro_bruto:       v.lb,
    despesas_fixas:   -v.df,
    ebitda:            v.ebt,
    impostos_lucro:   -v.imp,
    receitas_fin:      v.rf,
    despesas_fin:     -v.dfin,
    resultado_liquido: v.resL,
    investimentos:    -v.inv,
    resultado_final:   v.resF,
  }
}

export const fmtBRL   = (v) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
export const fmtCompact=(v) => {
  const a = Math.abs(v)
  return a >= 1e6 ? `R$${(a/1e6).toFixed(1)}mi` : a >= 1e3 ? `R$${(a/1e3).toFixed(0)}mil` : `R$${a.toFixed(0)}`
}
