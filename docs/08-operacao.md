# 08 — Operação

## Variáveis de ambiente

Configuradas na Vercel. **Nenhuma é versionada.**

### Obrigatórias

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase — exposta ao navegador |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anônima — exposta ao navegador, **protegida por RLS** |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de serviço — **ignora RLS**, só no servidor. Ver [07 § S1](07-seguranca.md) |
| `CRON_SECRET` | **única** autenticação do cron — sem ela toda execução agendada recebe 401. A Vercel envia `Authorization: Bearer <valor>` sozinha. Ausente de 15/07 a 16/10/2026 |

### Opcionais

| Variável | Uso | Padrão |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Management API — setup idempotente de colunas na sync; bucket de logo | sem ele, esses passos são pulados |
| `BLING_AUTH_URL` | endpoint de autorização OAuth | `https://www.bling.com.br/Api/v3/oauth/authorize` |
| `BLING_TOKEN_URL` | endpoint de token | `https://www.bling.com.br/Api/v3/oauth/token` |
| `BLING_API_BASE` | base da API | `https://api.bling.com.br/Api/v3` |
| `BLING_RATE_MIN_MS` | espaçamento entre chamadas | `380` |
| `BLING_REQ_TIMEOUT_MS` | timeout por requisição | `20000` |
| `BLING_BACKOFF_GATEWAY_MS` | espera após 5xx | `2000` |
| `BLING_BACKOFF_RATE_MS` | espera após 429 | `500` |
| `BLING_LIMITE_PAGINA` | títulos por página na sync | `30` |
| `BLING_DISABLE_JWT` | `1` desliga o header `enable-jwt` — **rollback de emergência** | ligado |

`NODE_ENV` é definida pela plataforma.

⚠️ `NEXT_PUBLIC_*` vão para o bundle do navegador. Nunca prefixar uma chave sensível
com `NEXT_PUBLIC_`.

Alterar variável na Vercel exige **redeploy** para ter efeito.

## Deploy

Push em `main` → Vercel faz build e publica em **~50–60 s**.

A versão do Node é a do **projeto na Vercel** (24.x), não a do `.nvmrc`. Ver
[01 § Stack](01-visao-geral.md).

### Antes de mergear

```bash
npm run build                                   # tem de compilar
for t in scripts/test-*.mjs; do node $t; done   # todas as suítes passando
```

**No Windows/PowerShell:** `npx eslint ...` falha ao repassar os argumentos. Use
`node node_modules/eslint/bin/eslint.js` com cada opção separada. A linha acima acusa 2 erros de
`react-hooks/exhaustive-deps` (regra de plugin não carregado com `--no-eslintrc`); só `no-undef` conta aqui.
O checkout no Windows traz CRLF — os testes estruturais precisam aceitar `\r\n`.

`npm run build` **não detecta erro de execução** — identificador indefinido, variável
usada antes da declaração. Para isso:

```bash
npx eslint --no-eslintrc --rule 'no-undef: error' \
  --parser-options=ecmaVersion:2022,sourceType:module,ecmaFeatures:{jsx:true} \
  --env browser,node,es2022 --ext .js,.jsx app lib components
```

*Incidente:* PRs #11 e #13 — cinco identificadores indefinidos compilaram sem erro e
quebraram em produção.

### Depois de mergear

```bash
git ls-remote --heads origin main                # confirma o SHA publicado
curl -s https://raw.githubusercontent.com/.../main/<arquivo> | grep <trecho>
```

Recarregar o portal com **Ctrl+Shift+R** para descartar cache.

### Rollback

Reverter o commit em `main` e aguardar o redeploy. Para a integração JWT,
`BLING_DISABLE_JWT=1` na Vercel reverte sem redeploy.

---

## Migrações

**Não há runner automático.** A migração precisa ser aplicada manualmente no SQL Editor.

### Ordem obrigatória

1. **Aplicar a migração no banco**
2. **Verificar** que a coluna ou tabela existe — consulta ao `information_schema`
3. **Só então** mergear o código que a usa

Código que depende de coluna inexistente quebra ao entrar em produção.

### Operações destrutivas

Antes de `DROP`, `DELETE` ou `UPDATE` em massa:

1. **Consultar o conteúdo** — com dados, não com expectativa
2. Confirmar que **nenhum código em produção** ainda usa o objeto
3. Mergear primeiro a remoção do código, **depois** apagar o objeto

O SQL Editor pede confirmação em operações destrutivas. Isso é desejável.

### Após INSERT de resultado incerto

Se a execução travou ou o editor congelou, **verificar com SELECT antes de repetir**.
Repetir às cegas pode duplicar registros — a menos que a operação seja idempotente
(`where not exists`).

---

## Sincronização Bling

### Rotina

Configurações › Integrações › **Sincronizar Fluxo agora**. Responder **Cancelar** na
pergunta sobre substituir registros de arquivo — adiciona e atualiza sem remover.

| Mensagem final | Significado | Ação |
|---|---|---|
| Varredura completa: N títulos | base percorrida inteira | nenhuma |
| … · M adiado(s) por tempo | títulos que não couberam no prazo | executar de novo até zerar |
| … · K removido(s) por exclusão no Bling | títulos apagados na origem | conferir se esperado |
| Parada parcial · posição salva | teto atingido | executar de novo — continua de onde parou |

### Testar mudança na integração

Sempre **uma entidade primeiro** — a JAM, de menor volume. Se passar, as outras duas.
Facesign por último.

### Verificar o formato dos tokens

```sql
select e.nome, length(i.access_token) as tamanho,
       case when i.access_token like 'ey%' then 'JWT' else 'OPACO' end as formato,
       i.token_expira_em
  from public.integracoes i join public.empresas e on e.id = i.empresa_id
 order by e.nome;
```

JWT começa com `ey` — Base64 de `{"`.

---

## Runbooks de incidente

### Cron não grava nada

**Verificar pelo banco**, não pelo log — o plano Hobby guarda só 1 hora:

```sql
select e.nome, i.ultima_sync_cron, i.cron_resultado
  from public.integracoes i join public.empresas e on e.id = i.empresa_id;
```

1. `ultima_sync_cron` antigo e `cron_resultado` sem `erro`: a rota não está sendo
   autenticada — conferir se `CRON_SECRET` existe em Vercel › Settings › Environment
   Variables (produção) e se houve redeploy depois de criá-la
2. `cron_resultado.erro` preenchido: a execução rodou e falhou — a mensagem está ali
3. `cron_resultado.interrompido`: Bling indisponível ou sem tempo — o cursor foi preservado

### Títulos em aberto que não atualizam

Título que sai da listagem do Bling (excluído, substituído, cancelado) só é
reconferido pela **fila de reconferência**, ao fim de uma varredura manual **completa**.

```sql
select e.nome, jsonb_array_length(coalesce(i.reconferir, '[]'::jsonb)) as na_fila,
       jsonb_array_length(coalesce(i.sync_vistos, '[]'::jsonb)) as vistos_na_varredura
  from public.integracoes i join public.empresas e on e.id = i.empresa_id;
```

Remoções feitas pela fila ficam em `audit_logs` com `changed_by_email =
'sistema:reconferencia'` e o registro completo em `old_data` — é de lá que se restaura.

### Coletar o JSON de borderôs de um título

Para examinar como o Bling registrou o pagamento de um título (data, borderôs, estornos,
valor pago por título). Requer a migração `20261030_diagnostico_bling`.

```sql
-- pedir (até 20 doc_refs por entidade)
update public.integracoes
   set diagnostico_bling = jsonb_build_object('pedidos', jsonb_build_array('bling:saida:ID1', 'bling:saida:ID2'))
 where empresa_id = '<empresa>';

-- acompanhar
select e.nome, jsonb_array_length(i.diagnostico_bling->'pedidos') pedidos,
       (select count(*) from jsonb_object_keys(coalesce(i.diagnostico_bling->'resultados', '{}'::jsonb))) coletados
  from public.integracoes i join public.empresas e on e.id = i.empresa_id;

-- depois da análise: esvaziar (o JSON bruto traz dados de contato)
update public.integracoes set diagnostico_bling = null where empresa_id = '<empresa>';
```

A coleta roda no cron do dia seguinte ou na próxima sincronização manual.

### Pago no sistema que não existe mais no Bling

Sintoma: as saídas ou entradas de um mês ficam **acima** do relatório de pagamentos do
Bling. Quem cobre é a **conferência dos liquidados** (R10.6), que roda depois da
reconferência na sincronização manual e numa fatia diária do cron.

```sql
select e.nome, i.conferencia_liquidados->>'etapa' as etapa,
       i.conferencia_liquidados->'janela' as janela,
       i.conferencia_liquidados->>'candidatos' as candidatos,
       i.conferencia_liquidados->>'liquidados' as liquidados,
       jsonb_array_length(coalesce(i.conferencia_liquidados->'fila', '[]'::jsonb)) as na_fila,
       i.conferencia_liquidados->>'concluida_em' as concluida_em
  from public.integracoes i join public.empresas e on e.id = i.empresa_id;
```

1. `etapa = suspeita`: candidatos acima de 5% dos liquidados, ou paginação em laço —
   **nada foi removido**. Ler `conferencia_liquidados->'motivo'`,
   `->'diagnostico'` (candidatos por tipo e mês, amostra) e `->'paginas_log'` (recebidos
   por página): página com poucos itens no meio da fase, ou fase inteira com 0, aponta
   para a listagem do Bling, não para exclusões.
   Não forçar: comparar uma amostra dos candidatos com o Bling antes de qualquer ação
2. `etapa = listagem` parada há dias: a página da posição salva está falhando no Bling —
   ver `cron_resultado.liquidados.interrompido`
3. Remoções ficam em `audit_logs` com `changed_by_email =
   'sistema:conferencia-liquidados'` e o registro completo em `old_data`

Para conciliar contra o relatório do Bling, cruzar por **valor do título + data de
liquidação**, não por nome: a descrição daqui às vezes é o histórico do título
("FORNECEDOR", "MULTA E JUROS DE ATRASO"), não o contato. Juros e multas pagos ficam de
fora daqui por regra (ADR-004) e aparecem como o sistema **abaixo** do Bling.

### "Failed to fetch" ao sincronizar

A função serverless morreu antes de responder. Causa mais provável: **estouro do
`maxDuration` de 60 s**.

1. Verificar se houve mudança recente que aumentou o custo por página
2. Reduzir `BLING_LIMITE_PAGINA` na Vercel — hoje 30
3. Conferir nos logs da Vercel a duração das últimas execuções

### Sincronização quebra com erro de autenticação

1. Configurações › Integrações › **Reconectar ao Bling** na entidade afetada
2. Se persistir, conferir se o Bling mudou o contrato
3. Em último caso, `BLING_DISABLE_JWT=1`

### Deploy falha sem compilar — Node descontinuado

**Sintoma:** o status da Vercel no PR é `failure` e o log termina em `Node.js Version "20.x"
is discontinued and must be upgraded`, sem nenhum erro de build. **Qualquer** deploy novo
falha, inclusive o da `main` — o último que passou é anterior à descontinuação.

1. Vercel › `financial-dashboard` › Settings › Build and Deployment › **Node.js Version** →
   `24.x`
2. Redeployar o último deployment que falhou
3. Conferir que o build compila e que a produção fica `READY`

*Incidente:* 15/10/2026 — ver [10 — Histórico](10-historico.md).

### Número diverge entre duas telas

Divergência entre telas que exibem a mesma grandeza é **sempre defeito**.

1. Confirmar **mesmo período e mesma entidade** nas duas telas
2. Verificar se ambas usam a mesma lib — ver [02 § Fontes únicas](02-arquitetura.md)
3. Verificar realizado × projetado — R2.4
4. Verificar recorte por data efetiva — R6.1
5. Rodar `test-consistencia-saldo`

### Tela mostra dados da entidade errada

1. Trocar a entidade e observar se os números mudam
2. Se não mudarem, a tela não escuta o evento `storage` — R9.2
3. Rodar `test-escopo-entidade`

---

## Acesso ao banco em desenvolvimento assistido

O ambiente de desenvolvimento assistido não alcança `*.supabase.co` diretamente — o
acesso é pela extensão do Claude no navegador.

- **Navegador correto:** Comet, com a sessão do Supabase ativa
- **Vários navegadores pareados na mesma conta** causam ambiguidade: a listagem não
  expõe os nomes e os identificadores trocam de posição entre chamadas.
  Manter **apenas o Comet** pareado elimina o problema
- A extensão hiberna com frequência. Recarregar o painel do Claude no Comet reativa

### Particularidades do SQL Editor

- O editor às vezes não fixa o cursor com clique por referência — **clicar por
  coordenada** funciona
- Consultas com mais de ~3.000 caracteres fazem a digitação estourar o tempo
- A grade de resultados é virtualizada: `get_page_text` não retorna células.
  Agregar com `string_agg` numa linha, ou ler por `document.body.innerText`
- Com banner "We are investigating a technical issue", o editor fica instável —
  **não executar escritas** nesse estado
