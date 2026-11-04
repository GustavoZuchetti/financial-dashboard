-- 20261103 — liquidação pelos borderôs (regra 2, substitui a ADR-004)
--
-- regra_liquidacao  2 = data do pagamento mais recente e valor pago com juros,
--                   lidos de TODOS os borderôs (lib/bling-reconferencia.js,
--                   liquidacaoDoTitulo). Pago sem 2 é considerado incompleto e
--                   relido pela sincronização. 1 = leitura incompleta de borderô.
-- liquidacoes       { confianca, pagamentos: [{ bordero, data, valorPago, juros,
--                   acrescimo, desconto, tarifa }], motivo? } — base para medir
--                   pagamentos parcelados e para um eventual lançamento por pagamento.
--
-- APLICAR ANTES do merge: o código lê e grava as duas colunas no upsert.
alter table public.fluxo_caixa add column if not exists regra_liquidacao smallint;
alter table public.fluxo_caixa add column if not exists liquidacoes jsonb;

notify pgrst, 'reload schema';
