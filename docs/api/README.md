# Referência Central — Contratos REST da API Mockada

## 1. Visão geral

Este documento consolida os contratos REST utilizados pela aplicação e implementados por meio do Mock Service Worker (MSW), localizado em `src/mocks/handlers/`.

Os schemas definidos com Zod servem como base para a validação dos dados e para a inferência dos tipos consumidos pelo cliente. Esses tipos são disponibilizados em `src/types/api.ts` por meio de re-exportações.

Os contratos específicos de cada recurso estão documentados separadamente:

- [Sessão](./session.md)
- [NFTs](./nfts.md)
- [Favoritos](./favorites.md)
- [Carrinho](./cart.md)
- [Cotação](./quote.md)
- [Pedidos](./orders.md)
- [Perfil](./profile.md)
- [Carteiras](./wallets.md)

## 2. Convenções da API

### Endpoint de saúde

`GET /api/_health` é um endpoint público utilizado para verificar se a API mockada está respondendo.

A resposta esperada é:

```json
{
  "ok": true
}
```

O status HTTP é `200 OK`, e o payload é validado pelo `healthSchema`. Durante a inicialização, o bootstrap da aplicação utiliza Axios para consultar esse endpoint antes de renderizar a interface.

### Padrões de comunicação

| Aspecto               | Convenção                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL base              | Configurada por `VITE_API_BASE_URL`. Nos ambientes de desenvolvimento e demonstração, aponta para o próprio bundle, com o MSW interceptando as requisições correspondentes a `*/api/*`. |
| Autenticação          | Header `Authorization: Bearer <token>`. Os endpoints identificados como 🔒 exigem uma sessão válida.                                                                                    |
| Acesso anônimo        | Carrinho e cotação aceitam `X-Anonymous-Id` quando não existe token de autenticação. O identificador UUID do visitante é armazenado em `localStorage`, na chave `gm_anon_id`.           |
| Conteúdo              | `Content-Type: application/json; charset=utf-8`.                                                                                                                                        |
| Valores em ETH        | Representados por strings decimais, como `"0.99"` e `"0.0042"`. Valores monetários não devem ser transmitidos como `number`.                                                            |
| Quantidades           | Campos como `qty`, `available` e propriedades de `edition` utilizam números inteiros.                                                                                                   |
| Datas                 | Formato ISO 8601, preferencialmente com indicação explícita de fuso horário, por exemplo `2026-10-07T18:00:00.000Z`.                                                                    |
| Endereços de carteira | Formato `0x` seguido de 40 caracteres hexadecimais. A validação ocorre tanto no cliente quanto na API mockada e não diferencia maiúsculas de minúsculas.                                |
| Paginação             | `page` começa em 1 e assume esse valor por padrão. `pageSize` utiliza 12 por padrão e aceita no máximo 48 itens.                                                                        |
| Versão de recursos    | Recursos mutáveis incluem `version: number` e `updatedAt`. Eventos Socket.IO utilizam a versão para controlar duplicações e ordenar atualizações.                                       |
| Idempotência          | `POST /api/orders` exige o header `Idempotency-Key`, contendo um UUID v4.                                                                                                               |

### Formato da paginação

As requisições paginadas utilizam os parâmetros `page` e `pageSize`.

O formato padrão da resposta é:

```ts
{
  items: unknown[];
  page: number;
  pageSize: number;
  total: number;
}
```

O campo `total` representa a quantidade total de registros disponíveis para a consulta, conforme os filtros aplicados.

## 3. Estrutura padrão dos erros

Todas as respostas HTTP com status igual ou superior a `400` devem seguir o envelope abaixo:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "fields": {
      "email": ["Informe um e-mail válido"]
    },
    "requestId": "req_7f3a"
  }
}
```

Os campos possuem as seguintes responsabilidades:

- `code`: identificador estável do erro, utilizado pela aplicação para decidir o tratamento adequado.
- `message`: descrição geral do problema.
- `fields`: lista de mensagens associadas a campos específicos do formulário. É disponibilizado em `VALIDATION_ERROR` e em `CONFLICT` quando o contrato do recurso prevê erros por campo.
- `requestId`: identificador opcional que auxilia na investigação de falhas e na correlação com logs.

A interface deve utilizar os códigos para determinar o comportamento esperado, em vez de depender exclusivamente do texto de `message`.

## 4. Catálogo de códigos de erro

| Código                 | HTTP | Condição                                                                     | Tratamento na interface                                                                            |
| ---------------------- | ---: | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`     |  422 | Payload ou formulário inválido.                                              | Mostrar mensagens nos campos correspondentes e um resumo dos erros, quando necessário.             |
| `UNAUTHORIZED`         |  401 | Token ausente ou inválido.                                                   | Limpar a sessão local e redirecionar para `/login?redirect=...`.                                   |
| `SESSION_EXPIRED`      |  401 | Uma sessão existente expirou.                                                | Aplicar o fluxo de autenticação, preservando o contexto recuperável, como um rascunho de checkout. |
| `FORBIDDEN`            |  403 | O usuário não tem permissão para acessar o recurso.                          | Exibir uma tela ou mensagem de acesso negado.                                                      |
| `NOT_FOUND`            |  404 | O recurso solicitado não existe.                                             | Apresentar a página 404 ou um estado vazio apropriado ao contexto.                                 |
| `CONFLICT`             |  409 | Um dado único, como e-mail, endereço ou nome de usuário, já está cadastrado. | Associar o erro ao campo correspondente.                                                           |
| `INSUFFICIENT_STOCK`   |  409 | A quantidade solicitada excede a disponibilidade da edição.                  | Exibir um aviso no item e permitir a revalidação do carrinho.                                      |
| `QUOTE_STALE`          |  409 | Preço ou disponibilidade mudou após a geração da cotação.                    | Buscar uma nova cotação e solicitar nova confirmação explícita do usuário.                         |
| `IDEMPOTENCY_CONFLICT` |  409 | Uma chave de idempotência foi reutilizada com um payload diferente.          | Impedir a repetição com a mesma chave e orientar a recuperação do pedido existente.                |
| `COUPON_INVALID`       |  422 | O cupom informado não existe.                                                | Mostrar o erro no campo do cupom.                                                                  |
| `COUPON_EXPIRED`       |  410 | O cupom está expirado.                                                       | Informar a expiração e oferecer a remoção do cupom.                                                |
| `RATE_LIMITED`         |  429 | A requisição excedeu o limite definido no cenário simulado.                  | Tentar novamente com backoff.                                                                      |
| `INTERNAL`             |  500 | O servidor mockado encontrou uma falha inesperada.                           | Exibir `ErrorState` com a opção “Tentar novamente”.                                                |
| `SERVICE_UNAVAILABLE`  |  503 | O serviço está indisponível no cenário simulado.                             | Exibir `ErrorState` e permitir nova tentativa.                                                     |

### Falhas de transporte

Problemas como perda de conexão ou timeout sem resposta HTTP não possuem o envelope JSON descrito anteriormente.

Nesses casos, o Axios converte a falha em um `AppError` com `kind: "network"`. A interface deve apresentar o estado de erro apropriado, com opção de tentar novamente.

## 5. Modelos e documentação por recurso

Os modelos são definidos por schemas Zod nos arquivos correspondentes a cada recurso. A tabela abaixo indica onde consultar os contratos específicos.

| Modelos                  | Documento      | Responsabilidade                                |
| ------------------------ | -------------- | ----------------------------------------------- |
| `Session`, `UserPublic`  | `session.md`   | Autenticação, sessão e dados públicos da conta. |
| `Nft`, `NftListResponse` | `nfts.md`      | Catálogo, listagem e detalhes de NFTs.          |
| `FavoritesResponse`      | `favorites.md` | Consulta e gerenciamento de favoritos.          |
| `Cart`, `CartItem`       | `cart.md`      | Itens, quantidades e operações do carrinho.     |
| `Quote`, `Coupon`        | `quote.md`     | Cotação, descontos e validação de cupons.       |
| `Order`, `OrderItem`     | `orders.md`    | Criação, acompanhamento e recibo de pedidos.    |
| `Profile`                | `profile.md`   | Dados e alterações do perfil do colecionador.   |
| `Wallet`                 | `wallets.md`   | Carteiras vinculadas à conta.                   |

A definição completa de cada schema, seus endpoints, payloads e respostas deve permanecer no documento específico do recurso, evitando duplicação e divergência entre contratos.

## 6. Regras transversais

### 6.1. Isolamento dos dados

Carrinho, favoritos, perfil, carteiras e pedidos devem respeitar a identidade do usuário autenticado. No caso de carrinho e cotação anônimos, o contexto é associado ao `X-Anonymous-Id`.

Ao trocar de sessão, a aplicação deve limpar ou invalidar os dados em cache associados ao usuário anterior. Nenhum dado privado pode ser reutilizado entre contas diferentes.

### 6.2. Imutabilidade do recibo

O pedido mantém um snapshot dos itens no momento de sua criação. Os dados presentes em `Order.items`, incluindo nome e preço, devem permanecer inalterados mesmo que o catálogo seja atualizado posteriormente.

O recibo de um pedido confirmado deve refletir as condições registradas na compra, e não os valores atuais dos NFTs.

### 6.3. Atualizações em tempo real

Alterações de preço, disponibilidade e status de pedidos podem ser comunicadas por Socket.IO, especialmente pelos eventos `nft.updated` e `order.updated`.

O canal em tempo real permite atualizar a interface sem depender exclusivamente de consultas periódicas. Entretanto, o REST continua sendo a fonte de verdade para reconciliação após reconexões ou perda de eventos.

As regras completas de sincronização estão documentadas em `ARCHITECTURE.md`, na seção 5.

### 6.4. Controle de respostas obsoletas

A API não garante que as respostas chegarão na mesma ordem em que as requisições foram iniciadas, pois a latência pode variar.

Para evitar que dados antigos sobrescrevam informações mais recentes, o cliente deve descartar respostas obsoletas, utilizando mecanismos como cancelamento por `query key`, `AbortSignal` e controle de versão, conforme o fluxo implementado.

Esse controle é especialmente importante para recursos mutáveis e operações que podem ocorrer simultaneamente, como atualização do carrinho, recotação e recebimento de eventos Socket.IO.

## 7. Responsabilidade dos contratos

Os contratos documentados definem a estrutura das requisições e respostas, os formatos de dados, os erros previstos e os comportamentos esperados da interface.

O MSW implementa esses contratos para permitir o desenvolvimento e a validação da aplicação sem depender de um backend real. Os schemas Zod garantem a validação estrutural dos dados e servem como fonte para os tipos consumidos pelo cliente.

Alterações em um endpoint devem ser refletidas de forma consistente nos handlers, nos schemas, nos tipos exportados e na documentação do recurso correspondente.
