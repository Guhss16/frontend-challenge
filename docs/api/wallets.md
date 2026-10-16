# Contrato — Carteiras

## 1. Visão geral

Todos os endpoints de carteiras exigem autenticação e devem garantir o isolamento dos dados por usuário.

A interface permite cadastrar no máximo duas carteiras por conta: uma principal e uma secundária. Deve existir exatamente uma carteira principal quando houver carteiras cadastradas, mas o usuário pode permanecer sem carteira principal quando não houver nenhuma carteira cadastrada.

## 2. Modelo de dados

```ts
type Wallet = {
  id: string; // Ex.: "wal_gustavo_principal"
  label: string; // Nome de exibição da carteira
  address: string; // Endereço hexadecimal com prefixo 0x
  network: 'ethereum' | 'sepolia';
  isPrimary: boolean; // Indica se é a carteira principal
  ensName?: string; // Ex.: "guhss16.eth"
  note?: string; // Observação do colecionador
  createdAt: string; // Data em formato ISO 8601
};
```

O endereço deve conter o prefixo `0x` seguido de 40 caracteres hexadecimais. A unicidade é verificada entre as carteiras do mesmo usuário, independentemente da rede selecionada.

## 3. Endpoints REST

### 3.1. `GET /api/wallets` — listar carteiras

**Acesso:** protegido por autenticação.

Retorna as carteiras cadastradas para o usuário da sessão atual.

**Resposta — `200 OK`:**

```json
{
  "items": []
}
```

O array `items` contém objetos `Wallet` e pode ter, no máximo, dois elementos.

### 3.2. `POST /api/wallets` — cadastrar carteira

**Acesso:** protegido por autenticação.

Cria uma carteira vinculada ao usuário autenticado.

**Requisição:**

```json
{
  "label": "Carteira principal",
  "address": "0xAbC…40hex",
  "network": "ethereum",
  "isPrimary": true,
  "ensName": "guhss16.eth",
  "note": "Observação da carteira"
}
```

Os campos `ensName` e `note` são opcionais.

**Resposta de sucesso — `201 Created`:**

Retorna o objeto `Wallet` criado.

**Respostas de erro**

| HTTP  | Código             | Condição e tratamento                                                                                                                  |
| ----- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `409` | `CONFLICT`         | O endereço já está cadastrado por esse usuário, inclusive quando associado a outra rede. O erro deve ser vinculado a `fields.address`. |
| `409` | `CONFLICT`         | O usuário já possui duas carteiras. Retornar `fields.form` com a mensagem `"Limite de duas carteiras atingido"`.                       |
| `422` | `VALIDATION_ERROR` | Endereço fora do padrão esperado, `label` vazio ou rede diferente de `ethereum` e `sepolia`.                                           |

### 3.3. `PATCH /api/wallets/:id` — atualizar carteira

**Acesso:** protegido por autenticação.

Atualiza parcialmente uma carteira existente, respeitando as regras de propriedade, unicidade e consistência com pedidos em andamento.

**Exemplo de requisição:**

```json
{
  "label": "Principal",
  "note": "Carteira para compras",
  "isPrimary": true,
  "network": "sepolia"
}
```

**Resposta de sucesso — `200 OK`:**

Retorna o objeto `Wallet` atualizado.

**Regras de atualização**

- **Alteração da carteira principal:** definir `isPrimary: true` promove a carteira selecionada e retira essa condição da anterior. A operação deve ocorrer de forma atômica no mock, evitando duas carteiras principais simultaneamente.
- **Alteração de rede:** a rede pode ser modificada, exceto quando houver um pedido pendente vinculado à carteira. Nesse caso, a API retorna `409 CONFLICT`.
- **Alteração de endereço:** é permitida, inclusive durante o checkout, desde que não exista pedido pendente vinculado e que o endereço não esteja duplicado em outra carteira do mesmo usuário.
- **Propriedade do recurso:** uma carteira pertencente a outro usuário não pode ser alterada pela sessão atual.

**Respostas de erro**

| HTTP  | Código             | Condição                                                                             |
| ----- | ------------------ | ------------------------------------------------------------------------------------ |
| `404` | `NOT_FOUND`        | O identificador da carteira não existe.                                              |
| `403` | `FORBIDDEN`        | A carteira pertence a outro usuário.                                                 |
| `409` | `CONFLICT`         | Existe duplicidade de endereço ou uma alteração incompatível com um pedido pendente. |
| `422` | `VALIDATION_ERROR` | Um ou mais campos enviados não atendem às regras de validação.                       |

## 4. Utilização no checkout

O checkout utiliza as carteiras cadastradas para identificar a carteira e a rede associadas à compra.

1. **Carregar carteiras:** `GET /api/wallets` preenche o seletor de carteiras. Quando a lista estiver vazia, a interface apresenta a chamada para ação “Cadastre em Carteiras”.
2. **Selecionar carteira e rede:** o usuário escolhe uma carteira e uma rede por meio de um `select` com as opções `ethereum` e `sepolia`.
3. **Simular a autorização:** a conexão é simulada no cliente, sem interação com uma blockchain real. O fluxo utiliza os estados `disconnected`, `connecting`, `connected` e `rejected`.
4. **Confirmar a compra:** a ação “Confirmar compra” abre o diálogo de autorização da carteira. Se o usuário rejeitar ou fechar o diálogo, o pedido não deve ser criado.
5. **Criar o pedido:** após a autorização simulada e a validação dos dados, a carteira selecionada e a rede escolhida são enviadas em `POST /api/orders`.

Não existe um botão separado para conectar a carteira. A autorização é iniciada pela ação “Confirmar compra”.

## 5. Edição da carteira no formulário de pagamento

A tarefa 12 amplia o contrato para permitir a atualização dos dados da carteira selecionada diretamente pelo formulário de pagamento, utilizando `PATCH /api/wallets/:id`.

### 5.1. Campos editáveis

Além dos campos já definidos no modelo `Wallet`, o formulário de checkout trabalha com os seguintes dados:

| Campo               | Regra                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `address`           | Obrigatório. Endereço no formato `0x` seguido de 40 caracteres hexadecimais.                     |
| `network`           | Obrigatório. Aceita `ethereum` ou `sepolia`.                                                     |
| `provider`          | Aceita `metamask`, `walletconnect` ou `coinbase`.                                                |
| `ensName`           | Deve ser vazio ou conter um nome `.eth` válido segundo a validação do projeto.                   |
| `secondaryIdentity` | Pode ser vazio, um endereço `0x` seguido de 40 caracteres hexadecimais ou um nome `.eth` válido. |
| `note`              | Observação com limite de 280 caracteres no formulário de checkout.                               |

O campo `provider` representa o tipo de provedor de carteira. Para carteiras legadas sem esse campo, a interface deve assumir `metamask` como valor padrão.

O formulário exige endereço, rede e tipo de carteira. Embora o contrato geral permita carteiras sem ENS, o fluxo específico do checkout exige o preenchimento de `ensName`.

### 5.2. Identidade secundária

`secondaryIdentity` é uma referência complementar associada à carteira selecionada. Esse campo não cria uma terceira carteira e não representa uma conexão adicional.

Sua finalidade é registrar uma identidade alternativa, seguindo os formatos permitidos para endereço ou nome `.eth`.

### 5.3. Regras de consistência durante o checkout

A atualização dos dados da carteira deve obedecer às seguintes restrições:

- Endereços duplicados em outras carteiras do mesmo usuário resultam em `409 CONFLICT`, com o erro associado a `fields.address`.
- Alterações de `address`, `network` ou `provider` são bloqueadas com `409 CONFLICT` enquanto houver um pedido pendente vinculado à carteira.
- Pedidos anteriores preservam seus snapshots. Alterações posteriores na carteira não modificam os dados registrados em pedidos já criados.
- Mudanças na identidade da carteira invalidam o estado de conexão e a revisão atual do checkout.
- Antes de abrir a autorização simulada, a ação “Confirmar compra” deve validar e atualizar os dados da carteira selecionada.

### 5.4. Seleção do nome ENS

O formulário de checkout disponibiliza um `select` de nomes `.eth` com as seguintes opções:

- `nft-marketplace.eth`
- `colecionador.eth`
- O nome associado à carteira atual, quando disponível.

Quando a carteira não possui ENS, o formulário inicia com `nft-marketplace.eth` selecionado.

Essa seleção é apenas informativa e simulada. Não existe consulta à blockchain, verificação de titularidade ou registro real de domínio. A exigência de ENS se aplica a esse fluxo de checkout, não ao cadastro geral de carteiras.

### 5.5. Seleção do provedor

A seleção de `provider` é apresentada por meio de um grupo de rádios posicionado abaixo da seção de revisão do checkout.

Esse grupo deve permanecer sincronizado com o campo “Tipo de carteira” do formulário. A autorização simulada é iniciada exclusivamente pela ação “Confirmar compra”, sem um botão adicional de conexão.
