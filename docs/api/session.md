# Contrato — Autenticação, Sessão e Conta

## 1. Modelos de dados

### `UserPublic`

Representa os dados públicos do usuário retornados pela API.

```ts
type UserPublic = {
  id: string; // Ex.: "usr_gustavo"
  name: string; // Ex.: "Gustavo S."
  email: string; // Ex.: "gustavo@email.com"
  username?: string; // Ex.: "guhss16.cpt"
  bio?: string;
  avatarUrl?: string; // Caminho /assets/... ou data URL
  createdAt: string; // Data em formato ISO 8601
};
```

### `Session`

Representa a sessão autenticada e seus dados de expiração.

```ts
type Session = {
  token: string; // Token opaco: "mock.<base64url>", não é um JWT real
  user: UserPublic;
  expiresAt: string; // Data ISO 8601; validade de 2 horas no mock
};
```

O token é utilizado para autenticar requisições protegidas. A sessão mockada possui duração de duas horas, salvo quando um cenário específico altera esse comportamento.

## 2. Endpoints de autenticação

### 2.1. `POST /api/auth/signup` — criação de conta

**Acesso:** público.

Cria uma nova conta e retorna os dados da sessão após o cadastro bem-sucedido.

**Requisição:**

```json
{
  "name": "Carlos Colecionador",
  "email": "carlos@nft-marketplace.test",
  "password": "Carlos1234"
}
```

**Resposta — `201 Created`:**

```json
{
  "token": "mock.…",
  "user": {
    "...": "..."
  },
  "expiresAt": "2026-10-07T20:00:00.000Z"
}
```

O objeto retornado segue o contrato de `Session`, incluindo os dados públicos do usuário.

**Regras de validação**

| Campo      | Requisito                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `name`     | Obrigatório, com no mínimo 2 e no máximo 60 caracteres.                                                     |
| `email`    | Obrigatório, em formato válido, normalizado para letras minúsculas e exclusivo entre as contas cadastradas. |
| `password` | Obrigatória, com pelo menos 8 caracteres e contendo ao menos uma letra e um número.                         |

**Respostas de erro**

| HTTP  | Código             | Condição                                                                                                |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `422` | `VALIDATION_ERROR` | Um ou mais campos não atendem às regras de validação. O objeto `fields` identifica os campos inválidos. |
| `409` | `CONFLICT`         | O endereço de e-mail já está cadastrado. O erro é associado a `fields.email`.                           |

### 2.2. `POST /api/auth/login` — autenticação

**Acesso:** público.

Valida as credenciais informadas e retorna uma sessão válida quando a autenticação é bem-sucedida.

**Requisição:**

```json
{
  "email": "gustavo@email.com",
  "password": "Gustavo11011",
  "anonymousId": "uuid-opcional"
}
```

O campo `anonymousId` é opcional e identifica o visitante que está iniciando uma sessão.

**Resposta de sucesso — `200 OK`:**

Retorna um objeto `Session`.

**Regras de autenticação**

- Credenciais inválidas resultam em `401 UNAUTHORIZED`, com a mensagem `"E-mail ou senha incorretos"`.
- A resposta não deve revelar se o e-mail ou a senha foi o responsável pela falha. Nesse caso, não são retornados erros específicos em `fields`.
- Dados malformados são rejeitados antes da comparação das credenciais, com `422 VALIDATION_ERROR`.
- Quando `anonymousId` é informado, o mock incorpora o carrinho do visitante ao carrinho da conta autenticada, conforme as regras descritas em `cart.md`.

**Respostas de erro**

| HTTP  | Código             | Condição                             |
| ----- | ------------------ | ------------------------------------ |
| `401` | `UNAUTHORIZED`     | E-mail ou senha incorretos.          |
| `422` | `VALIDATION_ERROR` | E-mail ou senha em formato inválido. |

### 2.3. `GET /api/auth/session` — recuperação da sessão

**Acesso:** protegido por autenticação.

Consulta e valida a sessão atual, retornando os dados do usuário autenticado e o prazo de expiração.

**Resposta de sucesso — `200 OK`:**

Retorna um objeto `Session`.

**Respostas de erro**

| HTTP  | Código            | Condição                                   |
| ----- | ----------------- | ------------------------------------------ |
| `401` | `SESSION_EXPIRED` | O token é conhecido, mas a sessão expirou. |
| `401` | `UNAUTHORIZED`    | O token está ausente ou não é reconhecido. |

A aplicação deve consultar esse endpoint uma vez durante a inicialização, antes de permitir a renderização de rotas privadas. O resultado determina se a sessão pode ser restaurada ou se o usuário precisa se autenticar novamente.

### 2.4. `POST /api/auth/logout` — encerramento da sessão

**Acesso:** protegido por autenticação, com comportamento idempotente.

Invalida o token da sessão atual no mock.

**Resposta de sucesso — `204 No Content`:**

Não retorna corpo na resposta.

Após a invalidação, novas requisições com o mesmo token devem receber `401 UNAUTHORIZED`.

A operação é idempotente: mesmo quando não existe uma sessão ativa, o endpoint retorna `204 No Content`.

## 3. Dados de teste e comportamento do mock

### Usuários predefinidos

O ambiente mockado disponibiliza duas contas de referência:

| Conta               | Perfil                                               |
| ------------------- | ---------------------------------------------------- |
| `gustavo@email.com` | Perfil completo, com carteiras e pedidos associados. |
| `gabriel@email.com` | Perfil simplificado, com menos dados cadastrados.    |

As credenciais e os dados completos dessas contas devem permanecer centralizados nas fixtures do projeto.

### Tratamento das senhas

O mock não deve persistir senhas em texto puro. Para simular o armazenamento de credenciais, utiliza um hash fictício, representado por um formato ilustrativo como `hash:<sha256>`.

Esse mecanismo existe exclusivamente para simulação e não deve ser interpretado como uma implementação de autenticação adequada para produção.

### Restauração dos dados

`POST /api/_mock/reset` restaura os usuários, as sessões e as demais entidades ao estado inicial definido pelas fixtures.

Esse endpoint permite repetir os fluxos de teste em um estado conhecido.

### Cenário de sessão expirada

O cenário `sessao-expirada` força a expiração imediata dos tokens após o login.

Ele permite validar o comportamento da aplicação quando a sessão deixa de ser válida durante a navegação ou no checkout, incluindo a recuperação de contexto e o redirecionamento para autenticação.
