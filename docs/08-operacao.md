# 08 — Operação

## Variáveis de ambiente

Configuradas na Vercel. **Nenhuma é versionada.**

### Obrigatórias

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase — exposta ao navegador |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anônima — exposta ao navegador, **protegida por RLS** |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de serviço — **ignora RLS**, só no servidor. Ver [07 § S1](07-seguranca.md) |
| `CRON_SECRET` | autenticação alternativa do cron |

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

### Antes de mergear

```bash
npm run build                                   # tem de compilar
for t in scripts/test-*.mjs; do node $t; done   # todas as suítes passando
```

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
