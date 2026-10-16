# Contrato de API — Carrinho de Compras

## Autenticação e identificação

O carrinho pode ser utilizado tanto por usuários autenticados quanto por visitantes. Para visitantes, a identificação é feita pelo cabeçalho `X-Anonymous-Id`. Usuários autenticados enviam suas credenciais por meio do cabeçalho `Authorization`.

Quando um visitante realiza o login, os produtos presentes em seu carrinho são incorporados ao carrinho da conta autenticada por meio de um processo de merge.

## Estrutura dos dados

Cada item mantém informações suficientes para sua exibição e para o cálculo dos valores, reduzindo a necessidade de consultas adicionais durante a navegação.

```ts
type CartItem = {
  nftId: string;
  name: string;
  image: string;
  price: string;
  qty: number;
  available: number;
  edition: {
    current: number;
    total: number;
  };
  lineTotal: string;
  updatedAt: string;
  tokenId?: string;
};

type Cart = {
  items: CartItem[];
  subtotal: string;
  itemCount: number;
  updatedAt: string;
  version: number;
};
```

### Significado dos campos

- `nftId`: identificador do NFT associado ao item.
- `name` e `image`: dados do catálogo utilizados na apresentação do produto.
- `price`: preço vigente no catálogo, sem preservar o valor histórico do momento em que o item foi adicionado.
- `qty`: quantidade selecionada, obrigatoriamente um inteiro maior ou igual a 1.
- `available`: quantidade atualmente disponível para compra naquela edição.
- `edition`: informações sobre a numeração e o total de unidades da edição.
- `lineTotal`: valor da linha, calculado pela multiplicação de `price` por `qty`, utilizando `decimal.js` e representação em string.
- `updatedAt`: data e hora da última atualização.
- `tokenId`: identificador opcional do token, utilizado na etapa de revisão do pagamento. Caso não esteja disponível em respostas antigas, o `nftId` serve como alternativa de identificação.

No objeto `Cart`, `subtotal` representa a soma dos valores de todas as linhas, `itemCount` corresponde à soma das quantidades e `version` identifica a versão do estado do carrinho.

## Endpoints disponíveis

### `GET /api/cart` — Consultar carrinho

**Acesso:** visitante ou usuário autenticado.

Retorna o estado atual do carrinho, incluindo seus itens, quantidades e valores calculados.

### `POST /api/cart/items` — Adicionar NFT

**Acesso:** visitante ou usuário autenticado.

Exemplo de requisição:

```json
{
  "nftId": "golden-signal-160",
  "qty": 2
}
```

A operação verifica a existência do NFT e a disponibilidade solicitada antes de atualizar o carrinho.

|  HTTP | Código               | Comportamento esperado                                                                                                                                  |
| ----: | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404` | `NOT_FOUND`          | O NFT informado não foi encontrado no catálogo.                                                                                                         |
| `409` | `INSUFFICIENT_STOCK` | A quantidade solicitada excede o disponível ou não há unidades em estoque. A interface informa a indisponibilidade e pode sugerir uma quantidade menor. |
| `422` | `VALIDATION_ERROR`   | A quantidade não é um número inteiro positivo ou é menor que 1.                                                                                         |

**Validação de estoque:** a disponibilidade é controlada por NFT e edição, compartilhando a referência de estoque utilizada pelo catálogo. Uma solicitação acima do limite não deve aumentar a quantidade do carrinho de maneira automática ou silenciosa.

### `PATCH /api/cart/items/:nftId` — Atualizar quantidade

**Acesso:** visitante ou usuário autenticado.

Permite modificar a quantidade de um NFT já presente no carrinho.

Exemplo:

```json
{
  "qty": 3
}
```

Em caso de sucesso, a API retorna o carrinho atualizado (`200 OK`).

|  HTTP | Código               | Comportamento esperado                                                                                                               |
| ----: | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `404` | `NOT_FOUND`          | O item não está presente no carrinho.                                                                                                |
| `409` | `INSUFFICIENT_STOCK` | A quantidade solicitada ultrapassa a disponibilidade atual. A interface preserva o último valor válido e informa o limite permitido. |
| `422` | `VALIDATION_ERROR`   | A quantidade enviada não atende às regras de validação.                                                                              |

### `DELETE /api/cart/items/:nftId` — Excluir item

**Acesso:** visitante ou usuário autenticado.

Remove o NFT indicado do carrinho e retorna o estado atualizado (`200 OK`).

Se o item não existir, a API pode responder com `404 NOT_FOUND`. Nesse caso, a interface trata a operação como uma remoção já concluída, evitando apresentar um erro desnecessário ao usuário.

## Persistência e ciclo de sessão

O ambiente simulado utiliza o `localStorage`, sob a chave `gm_db_v1`, para preservar o estado do carrinho entre atualizações da página.

- **Login:** os itens do carrinho anônimo são transferidos para o carrinho do usuário por meio do `anonymousId`.
- **Logout:** os dados privados associados à sessão deixam de estar disponíveis. Como o carrinho anônimo já foi consumido durante a transferência, ele começa vazio.
- **Atualização da página:** os itens persistidos continuam disponíveis após o refresh.

Esse comportamento descreve a implementação do mock e não implica, por si só, que o armazenamento definitivo de produção utilize `localStorage`.

## Sincronização de preços e estoque

O preço de cada item deve refletir o valor mais recente do catálogo, e não necessariamente aquele vigente no momento da inclusão.

Quando um evento `nft.updated` comunica uma alteração, o carrinho atualiza o preço correspondente, recalcula o total da linha e o subtotal e incrementa sua versão. Se o valor mudar, a interface apresenta uma notificação indicando o preço anterior e o novo, conforme o cenário de teste `preco-muda`.

A disponibilidade também deve respeitar o estoque corrente da edição. A atualização do catálogo não pode resultar em quantidades acima do limite permitido sem validação.

## Controle de concorrência e respostas assíncronas

Cada estado retornado pelo carrinho possui um campo `version`, utilizado para evitar que respostas antigas sobrescrevam informações mais recentes.

O cliente mantém a versão mais alta já aplicada e ignora qualquer resposta cuja versão seja inferior. Essa regra também é importante quando eventos e requisições REST chegam fora de ordem.

## Finalização do pedido

Após a confirmação da compra, o carrinho deve ser atualizado de acordo com o resultado efetivo do pedido.

Somente os itens e as quantidades realmente comprados são removidos. Caso parte dos produtos não tenha sido adquirida, essas unidades permanecem no carrinho para que o usuário possa continuar a compra posteriormente.
