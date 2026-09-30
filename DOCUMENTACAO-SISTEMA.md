# Importação — Documentação do Sistema

| Item | Valor |
|------|--------|
| Versão do sistema | 1.1.2 — Pedidos: lápis mantém Salvar visível |
| Última atualização | 30/09/2026 (o lápis abre a linha sem jogar a tabela de volta para o REF) |
| Fonte oficial | Este arquivo |

## 1. Como usar este documento

Fonte única de comportamento do sistema. Antes de mudar código, ler a ficha da tela afetada (§6) e as regras (§7). Toda mudança perceptível (tela, rota, regra, permissão) atualiza este arquivo na mesma entrega.

Módulos ainda sem ficha completa estão marcados como `Não documentado ainda.` — documentar ao tocar neles.

## 2. Tecnologias utilizadas

- Node.js + Express 5 (`server.js`)
- EJS (views em `views/`)
- PostgreSQL via `pg` (`src/config/db.js`, schema em `sql/schema.sql`, migrações em `sql/migrate_*.sql`)
- Sessão `express-session` + JWT em cookie (`src/middlewares/auth.js`, `src/services/authToken.js`)
- `exceljs` (exportação Excel do custo unitário)
- Tailwind CSS 4 (`public/css/input.css` → `public/css/output.css`) + estilos inline em `views/partials/header.ejs`
- PDF: não há biblioteca de PDF. Os documentos são páginas imprimíveis e o usuário usa **Salvar PDF** (diálogo de impressão do navegador).

### 2.1 Histórico de versões

| Versão | Nome | O que mudou |
|--------|------|-------------|
| 1.0.0 | Base | Pedidos, pagamentos, saldo/alocação, compras (desembaraço), análises, fornecedores, produtos, usuários |
| 1.1.0 | Pedidos: edição de itens e PDF fornecedor | Itens editáveis na ficha `/pedidos/:id`; trava de quantidade e Unit USD com pedido quitado; nova página `/pedidos/:id/lista-fornecedor` sem valores |
| 1.1.1 | Pedidos: lápis para editar item | Linhas de **Itens do invoice** aparecem em texto; o lápis abre uma linha por vez com **Salvar** e **Cancelar** |
| 1.1.2 | Pedidos: lápis mantém Salvar visível | Correção: ao clicar no lápis, a tabela voltava para a coluna REF e **Salvar**/**Cancelar** saíam da área visível. Agora a tabela fica onde estava e anda só o necessário para mostrar **Salvar** e **Cancelar** |

## 3. Mapa de telas / conexões

```
/pedidos ──> /pedidos/:id (ficha)
                ├── Editar ─────────> /pedidos/:id/editar (cabeçalho)
                ├── Relatório custo ─> /desembaraco/:id/relatorio (INTERNO, com valores)
                ├── PDF fornecedor ──> /pedidos/:id/lista-fornecedor (SEM valores)
                ├── Compras ────────> /desembaraco/:id
                └── Itens do invoice (editar / adicionar / remover na própria ficha)
```

## 4. Papéis e acesso

- `admin`: acessa tudo; único que muda status do pedido (`PUT /pedidos/:id/status` com `requireAdmin`) e que acessa `/usuarios` e `/configuracoes`.
- Demais usuários: acessam os módulos marcados nas permissões (`src/constants/permissoes.js` · `MODULOS`): dashboard, pedidos, produtos, fornecedores, pagamentos, saldo, desembaraco (Compras), analises.
- Todas as rotas de `/pedidos` (inclusive a lista para fornecedor) exigem login e permissão `pedidos`. Não existe link público/anônimo.

## 5. Índice de rotas e "onde olhar no código"

| Rota | O que faz | Código |
|------|-----------|--------|
| `GET /pedidos` | Lista de pedidos | `src/controllers/pedidoController.js` · `listar` |
| `GET /pedidos/:id` | Ficha do pedido | `pedidoController.detalhe` · `views/pedidos/show.ejs` |
| `GET /pedidos/:id/editar` · `PUT /pedidos/:id` | Cabeçalho (código, fornecedor, datas, observação, status para admin) | `formEditar` / `atualizar` · `views/pedidos/form.ejs` |
| `POST /pedidos/:id/itens` | Adicionar item | `adicionarItem` · `public/js/pedido-itens.js` |
| `PUT /pedidos/:id/itens/:itemId` | Editar item | `atualizarItem` · `public/js/pedido-itens.js` |
| `DELETE /pedidos/:id/itens/:itemId` | Remover item | `removerItem` |
| `GET /pedidos/:id/lista-fornecedor` | Lista sem valores para o fornecedor (imprimir / Salvar PDF). `?autoPrint=1` abre o diálogo de impressão | `listaFornecedor` · `views/pedidos/lista-fornecedor.ejs` |
| `GET /desembaraco/:id/relatorio` | Relatório de Custo Unitário (interno) | `src/controllers/desembaracoController.js` · `relatorio` · `views/desembaraco/relatorio.ejs` |

Outros módulos (`/pagamentos`, `/saldo`, `/produtos`, `/fornecedores`, `/desembaraco`, `/analises`, `/usuarios`, `/configuracoes`): montados em `server.js`. Não documentado ainda.

## 6. Telas e fluxos (fichas)

### 6.1 Ficha do pedido — `/pedidos/:id`

Toolbar: **Editar**, **Saldo**, **Pagamento**, **Relatório custo**, **PDF fornecedor**, **Compras**, **Excluir**.

#### Itens do invoice (tabela)

Cada linha aparece em texto. O lápis (**Editar item**) na coluna de ações abre só aquela linha em campos, com **Salvar** e **Cancelar**. Só uma linha fica aberta por vez: abrir outra fecha a anterior e descarta o que não foi salvo. **vs última** e **Remover** ficam sempre visíveis.

A tabela rola na horizontal quando é mais larga que o painel (lápis na última coluna). Ao clicar no lápis, o REF recebe o foco sem mover a tabela, e a rolagem avança só o necessário para **Salvar** e **Cancelar** ficarem visíveis (`pedido-itens.js` · `manterAcoesVisiveis`).

| Campo | O que é | Obrigatório | Regra / bloqueio | Onde olhar no código |
|-------|---------|-------------|------------------|----------------------|
| REF | Referência do item | Sim | Vazio → "Informe a REF do item." (400) | `pedidoController.atualizarItem` |
| Descrição | Descrição comercial | Não | — | idem |
| Qtd | Quantidade | Sim | Travado (somente leitura) se o pedido está quitado | `views/pedidos/show.ejs` · `pedido-itens.js` · `aplicarTrava` |
| Unit USD | Preço unitário em USD | Sim | Travado se o pedido está quitado | idem |
| Amount | Qtd × Unit USD | Calculado | Não editável; recalcula após salvar | `ItemPedido.amountUsd` |
| NCM | Classificação fiscal | Não | — | `atualizarItem` |
| Lápis | Abre a linha para edição | — | Fecha a outra linha aberta, descartando o que não foi salvo | `pedido-itens.js` · `abrirLinha` |
| Salvar | Grava a linha sem recarregar a página e volta a linha para texto | — | Enter em qualquer campo da linha também salva. Com erro (REF vazia, pedido quitado) a linha continua aberta | `pedido-itens.js` (submit `.form-editar-item`) |
| Cancelar | Descarta as alterações e volta a linha para texto | — | Não chama o servidor | `pedido-itens.js` · `fecharLinha` |
| vs última | Abre a análise do item contra a última compra | — | — | `/analises/comparativo/item/:ref` |
| Remover | Exclui o item (pede confirmação) | — | Não é bloqueado pela quitação | `removerItem` |

Após salvar, adicionar ou remover, os indicadores (Invoice USD, Alocado, Falta, Cobertura) e a trava de Qtd/Unit USD são atualizados na hora.

Alíquotas (II, IPI, PIS, COFINS, ICMS) não são editadas na tabela: a edição mantém as alíquotas já gravadas no item. Elas são definidas ao **Adicionar item**.

Mensagens na barra do formulário **Adicionar item**:
- "Item atualizado." — sucesso.
- "Informe a REF do item." — REF vazia.
- "Pedido quitado: quantidade e preço não podem mudar." — tentativa de mudar Qtd/Unit USD com pedido quitado (os campos voltam ao valor gravado).

### 6.2 Lista para fornecedor — `/pedidos/:id/lista-fornecedor`

Documento para enviar ao fornecedor. Abre em nova aba pelo botão **PDF fornecedor**.

Contém: código do pedido, data/hora de geração, fornecedor, status, início da fabricação, prevista de chegada e a tabela **# · REF · Descrição · Quantidade**, com total de peças.

Não contém (por regra): preços, Amount, totais em USD ou R$, saldo/cobertura, alocações, alíquotas, NCM, observações internas do pedido.

Botões (não saem na impressão): **← Voltar ao pedido**, **Imprimir**, **Salvar PDF**. Impressão em A4 retrato.

### 6.3 Relatório de Custo Unitário — `/desembaraco/:id/relatorio`

Uso interno. Contém Unit USD, Amount, custos em R$, impostos e alocações. Não enviar ao fornecedor.

## 7. Regras de negócio

- **Pedido quitado** = soma alocada em USD ≥ invoice USD e invoice > 0 (`src/services/saldoService.js` · `saldoPedido.coberto`). Na ficha aparece o selo "Quitado fornecedor".
- **Trava de valores com pedido quitado**: `PUT /pedidos/:id/itens/:itemId` recusa (409, código `ITEM_COBERTO`) qualquer mudança de quantidade ou preço USD. REF, descrição e NCM continuam editáveis.
- A trava não cobre **Adicionar item** e **Remover**: essas ações ainda alteram o invoice de um pedido quitado.
- O item precisa pertencer ao pedido da URL; caso contrário a edição responde 404.
- Status do pedido: `aberta`, `em_transito`, `embarcada`, `finalizada` (`src/utils/format.js` · `STATUS_PEDIDO`). Só admin altera.
- Data prevista de chegada = início da fabricação + 90 dias (`pedidoController` · `DIAS_PREVISTA_CHEGADA`).

## 8. Como usar o sistema (guia do dia a dia)

### Editar itens de um pedido

1. Menu **Pedidos** → **Detalhe** do pedido.
2. Na tabela **Itens do invoice**, clique no lápis da linha (se não aparecer, deslize a tabela para a direita). Os campos REF, descrição, quantidade, Unit USD e NCM abrem, e **Salvar**/**Cancelar** aparecem ao lado do lápis.
3. Altere o que precisar e clique **Salvar** (ou tecle Enter). A mensagem "Item atualizado." aparece, o Amount/indicadores mudam e a linha volta a texto.
4. Para desistir, clique **Cancelar**: a linha volta ao valor gravado.
5. Se o pedido está **Quitado fornecedor**, Qtd e Unit USD ficam cinza (somente leitura) mesmo com a linha aberta. Para mudar valores, é preciso primeiro ajustar as alocações no **Saldo**.

### Gerar o PDF para o fornecedor (sem valores)

1. Na ficha do pedido, clique **PDF fornecedor** (abre em nova aba).
2. Confira a lista: REF, descrição e quantidade.
3. Clique **Salvar PDF** e, no diálogo do navegador, escolha o destino **Salvar como PDF**.
4. Envie o arquivo ao fornecedor.

Não use **Relatório custo** para o fornecedor: ele tem preços e custos.

## 9. Checklist de validação

- [ ] Ficha do pedido: itens em texto; lápis abre uma linha; abrir outra fecha a primeira; Cancelar volta ao valor gravado.
- [ ] Tabela mais larga que o painel: deslizar até o lápis e clicar → a tabela não volta para o REF e **Salvar**/**Cancelar** ficam visíveis.
- [ ] Pedido não quitado: mudar Unit USD e salvar → Amount e Invoice USD atualizam sem recarregar e a linha fecha.
- [ ] Pedido quitado: Qtd e Unit USD em somente leitura; mudar descrição salva.
- [ ] PDF fornecedor: nenhum `R$`, `USD`, `$`, `Invoice`, `Alocado`, `NCM` na página.
- [ ] Relatório custo continua com valores.
- [ ] Pedido sem itens: PDF fornecedor mostra "Este pedido ainda não tem itens."

## 10. Segurança (só o que existe)

- Login obrigatório (`requireAuth`) e permissão por módulo (`requirePermissao`) em `server.js`.
- Edição de item confere se o item pertence ao pedido da URL.
- A lista para fornecedor recebe do controller só código, status, fornecedor, datas e itens (REF, descrição, quantidade); nenhum valor comercial chega ao template.

## 11. Deploy / ambiente (sem secrets)

- Variáveis em `.env` (modelo em `.env.example`): `PORT`, `NODE_ENV`, `DB_*`, `SESSION_SECRET`, `JWT_SECRET`, `ADMIN_*`.
- `npm run dev` (nodemon) ou `npm start`. O banco e as migrações são conferidos na subida (`src/config/ensureDb.js`).
- `npm run test:smoke` roda o smoke HTTP contra o servidor no ar.

## 12. Ao atualizar este documento

Atualizar: capa (versão + data), §2.1, a ficha da tela (§6), regras (§7), guia (§8) e `package.json` · `version`.
