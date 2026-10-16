# Contrato de API — Pedidos, Checkout e Recibos

## 1. Estrutura do pedido

Um pedido registra os dados da compra no momento em que é criado. As informações dos NFTs e os valores financeiros são armazenados como um snapshot, garantindo que o recibo permaneça consistente mesmo que o catálogo seja alterado posteriormente.

### Itens do pedido

```ts
type OrderItem = {
  nftId: string;
  name: string;
  image: string;
  edition: {
    current: number;
    total: number;
  };
  qty: number;
  unitPrice: string;
  lineTotal: string;
};
```

Os dados de cada item são congelados na criação do pedido. O preço unitário e o total da linha correspondem aos valores utilizados naquela transação, sem acompanhar futuras alterações no catálogo.

### Estados possíveis

```ts
type OrderStatus = 'pending' | 'confirmed' | 'declined';
```

- `pending`: pedido criado, aguardando a conclusão da simulação da transação.
- `confirmed`: compra concluída com sucesso.
- `declined`: transação recusada.

Os estados `confirmed` e `declined` são definitivos. Depois de atingir um desses estados, o pedido não pode retornar a `pending` nem transitar para o estado terminal oposto.

### Modelo completo

```ts
type Order = {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  currency: 'ETH';
  coupon: {
    code: string;
    type: 'percent' | 'fixed';
    value: number;
  } | null;
  wallet: {
    id: string;
    label: string;
    address: string;
    provider?: string;
    ensName?: string;
    secondaryIdentity?: string;
    note?: string;
  };
  network: string;
  txHash?: string;
  explorerUrl?: string;
  declineReason?: string;
  quoteVersion: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  collector?: {
    name: string;
    email: string;
    username?: string;
    profileName?: string;
    referralCode?: string;
  };
};
```

### Campos relevantes

- `subtotal`, `discount`, `networkFee` e `total`: registram os valores calculados para a operação.
- `currency`: moeda utilizada, definida como ETH.
- `coupon`: informações do cupom aplicado ou `null` quando nenhum cupom foi utilizado.
- `wallet`: identificação e dados da carteira utilizada no checkout.
- `network`: rede escolhida para a transação, como `ethereum` ou `sepolia`.
- `txHash`: identificador simulado da transação, disponível após a confirmação.
- `explorerUrl`: referência externa simulada para consulta da transação.
- `declineReason`: motivo da recusa, preenchido quando o pedido termina como `declined`.
- `quoteVersion`: versão da cotação revisada pelo usuário.
- `idempotencyKey`: chave que identifica a tentativa original de criação do pedido.
- `version`: contador usado para reconhecer atualizações do pedido e ignorar eventos Socket.IO duplicados.
- `collector`: informações opcionais do colecionador, registradas no momento da criação.

Os campos adicionais da carteira e do colecionador são opcionais para preservar a compatibilidade com pedidos antigos.

## 2. Criação de pedidos

### `POST /api/orders`

**Autenticação:** obrigatória.

Cria um novo pedido a partir do carrinho mantido pelo servidor. O cliente não envia os itens nem define os preços da compra: essas informações são recuperadas e validadas pela API.

A requisição exige o cabeçalho `Idempotency-Key`, contendo um UUID v4 que identifica a tentativa.

Exemplo:

```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

Corpo da requisição:

```json
{
  "coupon": "LAUNCH10",
  "walletId": "wal_principal",
  "network": "ethereum",
  "quoteVersion": 12
}
```

O campo `coupon` é opcional. Quando omitido ou definido como `null`, a criação ocorre sem cupom.

O campo `quoteVersion` deve corresponder à versão da cotação que o usuário revisou antes de confirmar o envio.

### Respostas de sucesso

- `201 Created`: pedido criado com estado inicial `pending`.
- `200 OK`: uma tentativa anterior com a mesma chave e o mesmo payload é reconhecida, retornando o pedido já existente.

A repetição da solicitação não pode criar uma segunda compra.

### Tratamento de erros

|  HTTP | Código                 | Tratamento esperado                                                                                                                                             |
| ----: | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `409` | `QUOTE_STALE`          | A cotação deixou de ser válida porque houve alteração de preço, disponibilidade ou cupom. Atualizar os dados e exigir uma nova revisão e confirmação explícita. |
| `409` | `INSUFFICIENT_STOCK`   | Um ou mais itens não possuem estoque suficiente. Atualizar o carrinho e impedir o envio até a correção.                                                         |
| `409` | `IDEMPOTENCY_CONFLICT` | A mesma chave foi utilizada com um payload diferente. Recuperar o pedido associado à tentativa original, sem criar outro.                                       |
| `422` | `VALIDATION_ERROR`     | Carteira, rede ou cupom informados são inválidos.                                                                                                               |
| `401` | `SESSION_EXPIRED`      | A sessão expirou durante o checkout. Preservar a tentativa, redirecionar para o login e retomá-la após a autenticação da mesma conta.                           |
| `404` | `NOT_FOUND`            | A carteira solicitada não existe.                                                                                                                               |

## 3. Consulta de pedido e recibo

### `GET /api/orders/:id`

**Autenticação:** obrigatória.

Retorna os dados e o estado atual do pedido identificado pelo parâmetro `id`.

- `200 OK`: pedido recuperado com sucesso.
- `404 NOT_FOUND`: pedido inexistente.
- `403 FORBIDDEN`: pedido pertencente a outro usuário.

A autorização deve garantir que uma conta não consiga consultar os pedidos privados de outra.

Se o pedido ainda estiver pendente, o cliente continua acompanhando seu estado até a conclusão. Isso pode ocorrer por meio de eventos Socket.IO, consultas pontuais ou polling de segurança.

O recibo utiliza exclusivamente os dados registrados no pedido confirmado, e não os valores atuais do catálogo ou do perfil do usuário.

## 4. Ciclo de vida da compra

O processo começa com o envio da requisição de criação e termina quando a simulação da transação define um resultado definitivo.

```text
Carrinho revisado
       |
       v
POST /api/orders
       |
       v
Pedido criado: pending
       |
       | Simulação da transação
       | aproximadamente 2–4 segundos
       |
       +---------------------+
       |                     |
       v                     v
   confirmed              declined
       |                     |
       v                     v
    Recibo               Mensagem de erro
    da compra            e carrinho mantido
```

Uma nova tentativa com a mesma chave recupera o pedido original, inclusive quando a primeira requisição sofreu timeout e o cliente não recebeu a resposta.

A criação do pedido, por si só, não comprova que a compra foi concluída. A tela de confirmação só pode ser apresentada quando a API ou um evento válido informar `status === "confirmed"`.

## 5. Idempotência e prevenção de duplicidade

O cliente mantém a tentativa de compra em `localStorage`, usando a chave `gm_pending_order`.

Estrutura persistida:

```ts
{
  key: string;
  payloadHash: string;
  orderId?: string;
  userId: string;
  payload: {
    coupon?: string | null;
    walletId: string;
    network: string;
    quoteVersion: number;
  };
}
```

O payload armazenado corresponde à requisição original validada com Zod. Essa persistência é um mecanismo interno do cliente e não altera o contrato REST.

### Regras de repetição

- Cliques repetidos não devem iniciar pedidos independentes.
- Em caso de timeout ou resposta incerta, a nova tentativa utiliza a mesma chave e o mesmo payload original.
- A chave não pode ser reutilizada com dados diferentes.
- O formulário preenchido posteriormente não substitui os dados congelados da tentativa em andamento.
- A tentativa permanece armazenada até alcançar um estado terminal ou ser descartada explicitamente quando permitido pelas regras do checkout.

Se uma solicitação for repetida com a mesma chave e o mesmo conteúdo, a API retorna o pedido já criado. Se o conteúdo divergir, retorna `409 IDEMPOTENCY_CONFLICT`, sem gerar uma nova compra.

## 6. Recuperação após refresh e reconexão

A aplicação precisa recuperar o contexto do checkout caso a página seja atualizada, a conexão caia ou a sessão expire.

O procedimento segue esta ordem:

1. Ao encontrar uma tentativa persistida com `orderId`, consultar `GET /api/orders/:id`.
2. Se ainda não houver um identificador de pedido, repetir a requisição original uma única vez, utilizando a chave de idempotência existente.
3. Se houver falha de transporte, manter os dados disponíveis para uma nova tentativa manual.
4. Ao restabelecer a conexão Socket.IO, buscar novamente o pedido ativo para reconciliar o estado local com o servidor.
5. Enquanto o pedido permanecer pendente, executar consultas de segurança a cada três segundos, além de processar eventos e realizar a reconciliação na reconexão.

A tentativa é vinculada ao usuário autenticado. Se a sessão expirar, seus dados são preservados. O login com a mesma conta permite retomar o processo.

Ao realizar logout ou entrar com outra conta, os dados privados da tentativa anterior devem ser descartados para evitar que sejam reutilizados pelo usuário errado.

## 7. Validação, revisão e liberação da tentativa

Nem todos os erros devem ser tratados como uma compra em andamento.

### Falhas definitivas

Erros de validação, cotação desatualizada ou estoque insuficiente podem liberar a tentativa atual, desde que não exista um resultado incerto que exija reconciliação.

No caso específico de `QUOTE_STALE`, o usuário precisa revisar novamente os valores atualizados e confirmar a compra antes de gerar uma nova tentativa com outra chave.

### Resultado incerto

Se houver timeout, falha de transporte ou conflito de idempotência, a tentativa original permanece congelada até que seu resultado seja esclarecido.

Isso impede que uma compra potencialmente criada seja substituída por outra requisição independente.

### Carteira e revisão do checkout

A carteira conectada e a revisão atual do checkout não são persistidas como autorização para uma nova compra.

Após uma recuperação de sessão, um novo envio exige que o usuário conecte a carteira e revise explicitamente os dados da operação. Essa exigência não altera o payload de uma tentativa anterior, que deve continuar utilizando os valores originalmente registrados.

## 8. Atualização do carrinho após a compra

A limpeza do carrinho acontece somente quando o pedido alcança o estado `confirmed`.

Nesse momento, o mock do servidor já remove as quantidades efetivamente compradas. Por isso, o cliente não deve executar uma segunda mutação de limpeza que possa remover itens ou quantidades indevidamente.

Se o pedido terminar como `declined`, o carrinho permanece intacto, permitindo que o usuário tente novamente.

A confirmação também invalida os dados de carrinho e cotação no cliente para que a interface busque os valores atualizados.

## 9. Recibo e imutabilidade dos dados

O recibo é uma representação do snapshot criado no momento da compra.

Consequentemente:

- Mudanças posteriores no preço do NFT não alteram o pedido.
- Alterações no nome, na imagem ou na edição do catálogo não modificam os itens já registrados.
- Atualizações posteriores no perfil do colecionador ou nos dados da carteira não reescrevem o recibo.
- Os dados financeiros exibidos devem corresponder aos valores armazenados no pedido confirmado.

O campo `explorerUrl` aponta para uma referência de exploração simulada. A interface deve identificá-la como externa e inerte, sem realizar navegação real para um explorador.

O recibo só pode ser renderizado como confirmação de compra após a obtenção de um estado `confirmed` proveniente da API ou de um evento válido do Socket.IO.

## 10. Dados do colecionador e informações da carteira

Pedidos novos podem incluir dados adicionais do colecionador:

```ts
type Collector = {
  name: string;
  email: string;
  username?: string;
  profileName?: string;
  referralCode?: string;
};
```

O objeto da carteira também pode conter `provider`, `ensName`, `secondaryIdentity` e `note`.

Essas propriedades são opcionais para permitir a leitura de pedidos criados antes da inclusão desses campos.

O mock registra os dados do colecionador depois que o formulário é salvo na conta e congela as informações utilizadas na criação do pedido. Modificações futuras no perfil ou na carteira não devem alterar o recibo de uma compra anterior.
