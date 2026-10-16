# Contrato de API — Cotação, Descontos e Cupons

## 1. Objetivo da cotação

A cotação representa o resumo financeiro utilizado na revisão e na confirmação de uma compra. Ela reúne os valores dos itens do carrinho, os descontos aplicáveis, a taxa de rede e o total estimado.

Antes de criar um pedido por meio de `POST /api/orders`, o servidor deve verificar novamente as informações que compõem a cotação. Se preços, disponibilidade ou condições do cupom tiverem mudado desde a última revisão, a operação poderá ser recusada com `409 QUOTE_STALE`, exigindo uma nova cotação e a confirmação explícita do usuário.

## 2. Modelos de dados

### Cupom de desconto

```ts id="71ag4d"
type Coupon = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  description: string;
  expiresAt?: string;
};
```

O código é normalizado para letras maiúsculas. O campo `type` determina como o desconto é interpretado: `percent` representa uma porcentagem, enquanto `fixed` representa um valor fixo em ETH.

Por exemplo, um cupom percentual com `value: 10` concede 10% de desconto. Para descontos fixos, o valor financeiro aplicado ao cálculo deve ser tratado como decimal, com representação em string nos valores monetários.

`description` contém o texto explicativo apresentado ao usuário. `expiresAt`, quando informado, define a data e hora de expiração no formato ISO.

### Cotação

```ts id="3v5qfk"
type Quote = {
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  currency: 'ETH';
  coupon: Coupon | null;
  quoteVersion: number;
  items: {
    nftId: string;
    qty: number;
    unitPrice: string;
    available: number;
  }[];
  available: boolean;
  updatedAt: string;
};
```

Os campos financeiros representam:

- `subtotal`: soma dos valores das linhas do carrinho.
- `discount`: desconto calculado para a compra, ou `"0"` quando nenhum desconto for aplicado.
- `networkFee`: taxa de rede simulada.
- `total`: resultado da operação `subtotal - discount + networkFee`.
- `currency`: moeda da cotação, definida como ETH.
- `coupon`: dados do cupom aplicado ou `null` quando não houver cupom válido aplicado.
- `quoteVersion`: identificador da versão da cotação, atualizado quando houver mudanças relevantes nos preços, na disponibilidade ou nas condições do cupom.
- `items`: representação dos itens avaliados, com identificador, quantidade, preço unitário e estoque disponível.
- `available`: informa se todos os itens possuem disponibilidade suficiente para a compra.
- `updatedAt`: data e hora da última atualização.

## 3. Geração do resumo financeiro

### `POST /api/cart/quote`

**Acesso:** visitante ou usuário autenticado.

Calcula os valores atuais do carrinho e retorna um objeto `Quote`.

Exemplo de requisição:

```json id="jx0zce"
{
  "coupon": "LAUNCH10"
}
```

O campo `coupon` é opcional. Quando não for enviado, a cotação será calculada sem desconto.

### Respostas e erros

|  HTTP | Código               | Comportamento esperado                                                                                                           |
| ----: | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `200` | —                    | Cotação calculada e retornada com os valores atuais.                                                                             |
| `422` | `COUPON_INVALID`     | O código informado não existe. A interface mostra o erro no campo do cupom e mantém o subtotal disponível, sem aplicar desconto. |
| `410` | `COUPON_EXPIRED`     | O cupom expirou. A interface informa especificamente a expiração e oferece a opção de removê-lo.                                 |
| `409` | `INSUFFICIENT_STOCK` | Algum item não possui disponibilidade suficiente. A interface apresenta um aviso e permite remover ou revalidar o item afetado.  |
| `422` | `VALIDATION_ERROR`   | O carrinho está vazio ou o campo do cupom possui formato inválido.                                                               |

Um cupom inválido ou expirado não deve impedir a consulta do subtotal. A falha afeta a aplicação do desconto, mas não elimina a possibilidade de visualizar os demais valores da compra.

### Quando recalcular

A aplicação deve solicitar uma nova cotação:

- Ao abrir o carrinho ou iniciar o checkout.
- Após receber um evento `nft.updated`.
- Sempre que ocorrer uma alteração relevante nos itens ou nas condições da compra.

A versão retornada deve acompanhar a revisão apresentada ao usuário. No envio do pedido, o cliente transmite o `quoteVersion` utilizado para a confirmação.

## 4. Validação individual de cupons

### `POST /api/coupons/validate`

**Acesso:** visitante ou usuário autenticado.

Permite verificar um código de desconto separadamente, antes de aplicá-lo ao resumo financeiro. É utilizado pelo componente `CouponInput` para apresentar um retorno imediato sobre a validade do código.

Exemplo de requisição:

```json id="zrmx0b"
{
  "code": "LAUNCH10"
}
```

**Respostas possíveis:**

- `200 OK`: cupom válido, retornado no formato `{ coupon: Coupon }`.
- `422 COUPON_INVALID`: código inexistente.
- `410 COUPON_EXPIRED`: código fora do período de validade.

Essa validação isolada não substitui a cotação do carrinho. O cálculo final precisa considerar os itens e os valores vigentes no momento da revisão.

## 5. Cupons disponíveis nas fixtures

O mock fornece os seguintes cenários para testar a aplicação de descontos e o tratamento de erros.

| Código     | Regra de desconto              | Situação                            |
| ---------- | ------------------------------ | ----------------------------------- |
| `LAUNCH10` | 10% — “Desconto do lançamento” | Válido                              |
| `GREEN5`   | 5%                             | Válido                              |
| `EXPIRED`  | 15%                            | Expirado, com data anterior à atual |
| `FAKE`     | Sem desconto                   | Código inexistente                  |

Os cupons expirados devem produzir `410 COUPON_EXPIRED`, enquanto os códigos inexistentes resultam em `422 COUPON_INVALID`.

## 6. Política de cálculo monetário

Todas as operações financeiras são realizadas com `decimal.js`, utilizando representações decimais em string e as funções centralizadas em `lib/money.ts`.

A fórmula utilizada para calcular o total é:

\[
\text{total} = \text{subtotal} - \text{discount} + \text{networkFee}
\]

O subtotal corresponde à soma dos valores de todas as linhas do carrinho. O desconto é calculado conforme o tipo de cupom, e a taxa de rede é acrescentada ao resultado.

### Precisão e apresentação

- Os valores monetários são calculados com precisão decimal, evitando erros comuns de ponto flutuante.
- Os preços unitários são apresentados com até duas casas decimais.
- A taxa de rede e o total são apresentados com até quatro casas decimais.
- A formatação visual não deve substituir os valores utilizados nos cálculos internos.

### Taxa de rede

A taxa é simulada e determinística para cada cenário de teste. Um exemplo de valor é `0.0042` ETH.

Ela permanece consistente dentro do mesmo cenário e só varia quando as condições do cenário de teste determinam essa mudança.

## 7. Fonte de verdade e sincronização com a interface

A cotação retornada pela API é a referência oficial para os valores financeiros exibidos no checkout.

O cliente não deve recalcular independentemente o total definitivo, o desconto ou a taxa de rede. Pode utilizar os dados locais para fornecer feedback imediato entre consultas, mas precisa reconciliar esses valores com a resposta mais recente do servidor.

Antes de confirmar a compra, a versão da cotação deve ser validada novamente. Se houver alterações que invalidem a revisão anterior, o checkout deve apresentar os valores atualizados e exigir uma nova confirmação explícita.

Dessa forma, a compra não é concluída silenciosamente com valores diferentes daqueles que o usuário revisou.
