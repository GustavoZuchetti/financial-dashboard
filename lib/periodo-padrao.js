// ─── periodo-padrao.js — janela inicial das telas ───────────────────────────
//
// FONTE ÚNICA do período que cada tela abre por padrão.
//
// ── Por que existe ──────────────────────────────────────────────────────────
// Havia seis inicializações diferentes espalhadas pelas telas:
//
//   fluxo-caixa          `${curYear - 2}-01-01`      → 01/01/2024
//   overview, dre        1º de janeiro do ano        → 01/01/2026
//   gestao               hoje − 30 dias
//   comparativos         ano corrente x ano anterior
//
// Consequência direta: "Caixa Disponível" na Visão Geral e o saldo acumulado
// no Fluxo de Caixa partiam de âncoras distintas e acumulavam janelas
// distintas. Eram a MESMA informação em telas diferentes, com resultados
// diferentes — e nenhuma delas declarava o recorte em uso.
//
// Decisão do Controller em 11/09/2026: **toda tela abre no mês vigente**. O
// login fica previsível, e o filtro passa a ser escolha consciente do usuário
// em vez de um padrão herdado que ninguém lembrava.
//
// O padrão de dois anos era especialmente nocivo: a base só se torna confiável
// a partir de julho/2026 (ver conciliação de 25/08), então ele arrastava dois
// anos e meio de dados incompletos para dentro do saldo exibido.

const iso = (d) => d.toISOString().split('T')[0]

export function hojeISO() {
  return iso(new Date())
}

// Primeiro e último dia do mês corrente.
export function mesVigente(ref = new Date()) {
  const ini = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), 1))
  const fim = new Date(Date.UTC(ref.getFullYear(), ref.getMonth() + 1, 0))
  return { inicio: iso(ini), fim: iso(fim) }
}

// Mês anterior — usado como período de comparação.
export function mesAnterior(ref = new Date()) {
  const ini = new Date(Date.UTC(ref.getFullYear(), ref.getMonth() - 1, 1))
  const fim = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), 0))
  return { inicio: iso(ini), fim: iso(fim) }
}

// Atalhos usados pelas telas na inicialização do estado.
export const inicioMesVigente = () => mesVigente().inicio
export const fimMesVigente    = () => mesVigente().fim

// Rótulo legível do recorte, para o cabeçalho das telas. Toda tela que exibe
// número acumulado precisa declarar de onde até onde — foi a ausência disso
// que permitiu a divergência passar despercebida.
export function rotuloPeriodo(inicio, fim) {
  const br = (d) => String(d).split('-').reverse().join('/')
  return `${br(inicio)} a ${br(fim)}`
}
