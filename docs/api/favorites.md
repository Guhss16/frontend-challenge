# Contrato de API — Favoritos

## Autenticação e isolamento de dados

Todas as operações de favoritos exigem uma sessão válida. Cada usuário possui sua própria lista, sem acesso ou interferência nas preferências de outras contas.

## Estrutura da resposta

A API retorna os identificadores dos NFTs favoritados pelo usuário autenticado, acompanhados da quantidade total de registros.

```ts
type FavoritesResponse = {
  ids: string[];
  count: number;
};
```

- `ids`: lista de identificadores dos NFTs marcados como favoritos pela conta atual.
- `count`: número total de NFTs presentes nessa lista.

## Endpoints

### `GET /api/favorites` — Consultar favoritos

**Autenticação:** obrigatória.

Retorna a lista completa de favoritos do usuário e seu total.

Exemplo de resposta (`200 OK`):

```json
{
  "ids": ["golden-signal-160", "sage-nomad-009"],
  "count": 2
}
```

### `PUT /api/favorites/:nftId` — Adicionar aos favoritos

**Autenticação:** obrigatória.

Inclui o NFT informado na lista de favoritos e retorna o estado atualizado por meio de `FavoritesResponse`.

A operação é idempotente: se o NFT já estiver na lista, a API mantém os dados existentes e responde com `200 OK`, sem duplicar o registro ou provocar efeitos adicionais.

|  HTTP | Código                             | Descrição                                                        |
| ----: | ---------------------------------- | ---------------------------------------------------------------- |
| `200` | —                                  | Favorito adicionado ou já existente. Retorna a lista atualizada. |
| `404` | `NOT_FOUND`                        | O NFT solicitado não existe.                                     |
| `401` | `SESSION_EXPIRED` / `UNAUTHORIZED` | A sessão expirou ou a autenticação não é válida.                 |

### `DELETE /api/favorites/:nftId` — Remover dos favoritos

**Autenticação:** obrigatória.

Exclui o NFT da lista do usuário e retorna a relação atualizada com status `200 OK`.

A remoção também é idempotente. Se o NFT não estiver favoritado, a solicitação continua sendo considerada bem-sucedida. O status `404 NOT_FOUND` é reservado para situações em que o NFT não existe.

## Comportamento da interface

### Atualização otimista

As alterações devem ser refletidas na interface antes da confirmação da API, proporcionando uma resposta imediata às ações do usuário.

O fluxo de mutação segue estas etapas:

1. **`onMutate`:** cancela consultas em andamento relacionadas aos favoritos e registra um snapshot do estado anterior antes de atualizar os dados localmente.
2. **`onError`:** restaura o estado salvo caso a operação falhe e apresenta uma notificação (_toast_) informando o problema.
3. **`onSettled`:** invalida as consultas de favoritos para buscar o estado atualizado e reconciliar os dados locais com a resposta do servidor.

### Acesso de visitantes

Se um visitante tentar favoritar um NFT, a aplicação deve direcioná-lo para a página de login, incluindo a rota de origem no parâmetro `redirect`.

Exemplo:

`/login?redirect=<rota-atual>`

Após a autenticação, o usuário retorna à página de onde veio. A operação de favoritar pode então ser executada novamente.

### Contagem de favoritos nos cards

O campo `favoritesCount` exibido nos cards utiliza o valor fornecido pelos dados do catálogo. Caso esse número apresente alguma divergência em relação aos dados atualizados, a inconsistência será corrigida na próxima consulta (_refetch_).

Essa diferença não deve impedir a interação do usuário com os favoritos nem bloquear a renderização da interface.
