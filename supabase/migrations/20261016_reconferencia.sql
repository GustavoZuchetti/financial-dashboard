-- Fila de reconferência dos títulos que a listagem do Bling deixou de devolver.
-- Ver lib/bling-reconferencia.js e docs/05-integracao-bling.md.
--
-- sync_vistos  ids devolvidos pela listagem durante a varredura manual em curso;
--              zerado quando a varredura recomeça e ao terminar.
-- reconferir   fila de doc_refs em aberto/parciais que a última varredura
--              completa não viu, a conferir no Bling pelo id.
--
-- Aditiva e inerte: o código grava estas colunas numa atualização separada, e
-- sem elas a sincronização segue funcionando (só a reconferência não ocorre).
-- APLICAR ANTES do deploy do código que as usa.
alter table public.integracoes add column if not exists sync_vistos jsonb;
alter table public.integracoes add column if not exists reconferir jsonb;
notify pgrst, 'reload schema';
