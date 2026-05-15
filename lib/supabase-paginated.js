/**
 * fetchAllRows — busca todos os registros de uma tabela com paginação automática.
 * Resolve o limite de 1000 registros por request do Supabase REST API.
 *
 * @param {Function} buildQuery - função que recebe (from, pageStart, pageEnd) e retorna a query
 * @returns {Array} todos os registros
 */
export async function fetchAllRows(buildQuery) {
  let all = [], page = 0
  while (true) {
    const { data, error } = await buildQuery(page * 1000, (page + 1) * 1000 - 1)
    if (error || !data || data.length === 0) break
    all = all.concat(data)
    if (data.length < 1000) break
    page++
  }
  return all
}
