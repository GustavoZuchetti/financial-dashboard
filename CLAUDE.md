# CLAUDE.md — Protocolo de trabalho neste repositório

> Leia este arquivo **antes de qualquer ação** neste projeto.

## Primeiro passo de toda sessão

1. Ler **[docs/README.md](docs/README.md)** — o índice
2. Ler **[docs/11-pendencias.md](docs/11-pendencias.md)** — em especial a seção
   **"Estado incerto"**, que lista o que precisa ser verificado antes de qualquer coisa
3. Ler **[docs/04-regras-de-negocio.md](docs/04-regras-de-negocio.md)** antes de tocar
   em qualquer cálculo
4. Conferir se `main` avançou desde a última sessão: `git log --oneline -10`.
   **Outras sessões trabalham neste repositório** — em agosto, os PRs #6 a #9; em
   setembro, o commit `34e95d3`

## Quando perguntarem algo sobre o sistema

**Consultar `docs/` antes de responder.** A documentação foi escrita a partir do código
e de consultas ao banco; a memória da conversa já produziu afirmações erradas nesta base.

Se a documentação e o código divergirem, **o código vence** — e a documentação deve
ser corrigida no mesmo trabalho.

## Regras de trabalho

**Verificar antes de afirmar.** Afirmação sobre o estado do banco ou da produção exige
consulta executada. "Deve estar", "provavelmente" e "espero que" não são verificação.
*Caso real:* afirmou-se que uma tabela estava vazia antes de consultá-la; o Controller
exigiu a consulta.

**Verificar nomes contra a origem.** Nomes de categoria, de conta ou de coluna vêm do
banco, nunca digitados de memória. *Caso real:* uma conta inexistente foi inventada ao
transcrever a lista de categorias.

**Planejar e avaliar risco antes de mudar comportamento.** O Controller pediu
explicitamente planejamento prévio depois que uma correção derrubou a sincronização
(PR #17). Toda mudança que afeta cálculo, integração ou dados passa por:
superfície afetada → riscos → mitigação → teste controlado.

**Testar em uma entidade antes das três.** JAM primeiro, Facesign por último.

**Corrigir todas as telas de uma vez.** Corrigir uma por vez produz divergência entre
elas — foi o que o PR #20 fez antes do #21.

**Perguntar antes de alterar comportamento não solicitado.**

**Operação destrutiva:** consultar o conteúdo, confirmar que nenhum código o usa,
remover o código primeiro, apagar o objeto depois.

**Após INSERT de resultado incerto:** SELECT antes de repetir.

## Antes de mergear

```bash
npm run build
for t in scripts/test-*.mjs; do node "$t"; done
npx eslint --no-eslintrc --rule 'no-undef: error' \
  --parser-options=ecmaVersion:2022,sourceType:module,ecmaFeatures:{jsx:true} \
  --env browser,node,es2022 --ext .js,.jsx app lib components
```

`npm run build` não detecta erro de execução.

## Atualização da documentação

**Toda mudança relevante atualiza `docs/` no mesmo PR.** Ver a tabela em
[docs/README.md § Protocolo de atualização](docs/README.md#protocolo-de-atualização).

Ao concluir qualquer trabalho:
- [ ] `10-historico.md` — registrar a entrega, e o incidente se houver
- [ ] `11-pendencias.md` — fechar o que foi resolvido, abrir o que surgiu
- [ ] o documento do assunto — 03, 04, 05 ou 06
- [ ] data de revisão em `docs/README.md`

## Segurança

**Nenhum segredo em código, documentação, commit ou log.** Nem truncado.
O repositório é público.

## Acesso ao banco

O ambiente não alcança `*.supabase.co`. O acesso é pela extensão do Claude no navegador
**Comet**. Detalhes e particularidades do SQL Editor em
[docs/08-operacao.md](docs/08-operacao.md#acesso-ao-banco-em-desenvolvimento-assistido).

Com vários navegadores pareados, a listagem não expõe nomes e os identificadores trocam
de posição. **Confirmar com o Controller qual usar** — nunca adivinhar.

## Idioma e audiência

Português (Brasil), linguagem executiva. Os números deste sistema vão a CEO, CTO e
investidores: um KPI errado é informação falsa entregue a quem decide.
