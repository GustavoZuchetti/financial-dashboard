'use client'
// ─── usar-versao-selecao.js — recarga a cada troca de entidade ──────────────
//
// Devolve um contador que INCREMENTA a cada troca da seleção de entidades.
// As telas o colocam nas dependências do efeito que resolve as entidades.
//
// ── Por que existe ──────────────────────────────────────────────────────────
// As telas recalculavam as entidades só quando `empresa_id` mudava. Mas ele
// vale 'todas' para QUALQUER seleção com mais de uma entidade: passar de três
// para duas não o alterava, o efeito não rodava, e a tela seguia exibindo as
// três. Encontrado em 30/09/2026 em doze telas. Duas delas — Atrasados e
// Orçamento — não reagiam a troca nenhuma: resolviam as entidades uma única
// vez, ao abrir.
//
// ── Filtro de chave ─────────────────────────────────────────────────────────
// O evento 'storage' NATIVO chega de outras abas quando QUALQUER chave muda —
// inclusive o tema. Sem filtro, trocar o tema numa aba recarregaria os dados de
// todas as outras. O evento SINTÉTICO de definirSelecaoEntidades() não tem
// `key`, então é sempre aceito.
//
// Fica fora de lib/selecao-entidade.js de propósito: aquela lib não importa
// React e é testada em Node puro.
import { useEffect, useState } from 'react'
import { EVENTO_SELECAO } from './selecao-entidade'

export const CHAVES_SELECAO = ['empresa_id', 'empresa_ids']

// Decide se um evento representa troca de seleção. Exportada para teste.
export function ehTrocaDeSelecao(evento) {
  const k = evento?.key
  if (k === undefined || k === null) return true   // sintético, ou clear() nativo
  return CHAVES_SELECAO.includes(k)
}

export function useVersaoSelecao() {
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    const h = (e) => { if (ehTrocaDeSelecao(e)) setVersao(v => v + 1) }
    window.addEventListener(EVENTO_SELECAO, h)
    return () => window.removeEventListener(EVENTO_SELECAO, h)
  }, [])
  return versao
}
