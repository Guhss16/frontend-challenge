# Contrato de API — Perfil do Colecionador

## 1. Autenticação e acesso

Todas as operações de perfil exigem uma sessão autenticada. As consultas e alterações devem atuar exclusivamente sobre os dados da conta associada à sessão atual, sem permitir acesso ou modificação de perfis de terceiros.

## 2. Modelo de dados

O perfil reúne as informações pessoais e públicas do colecionador, além dos dados utilizados durante o checkout.

```ts
type Profile = {
  id: string;
  name: string;
  email: string;
  profileName?: string;
  referralCode?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  walletCount: number;
};
```

### Descrição dos campos

- `id`: identificador da conta.
- `name`: nome de exibição do usuário.
- `email`: endereço de e-mail utilizado no login e editável pelo checkout.
- `profileName`: nome público apresentado no perfil.
- `referralCode`: código informativo de indicação, quando cadastrado.
- `username`: identificador público exclusivo, como `guhss16.cpt`.
- `bio`: descrição pessoal limitada a 280 caracteres.
- `avatarUrl`: endereço da imagem de perfil, que pode apontar para um arquivo local ou conter uma data URL.
- `createdAt`: data de criação da conta.
- `walletCount`: quantidade de carteiras associadas ao usuário, calculada a partir dos dados existentes e utilizada no resumo do perfil.

Os campos opcionais permitem que contas antigas continuem compatíveis com o modelo atualizado.

## 3. Consulta do perfil

### `GET /api/profile`

**Autenticação:** obrigatória.

Retorna os dados do perfil pertencente ao usuário autenticado, conforme o modelo `Profile`, com status `200 OK`.

Se o avatar tiver sido removido, a propriedade `avatarUrl` não será incluída na resposta.

## 4. Atualização dos dados pessoais

### `PATCH /api/profile`

**Autenticação:** obrigatória.

Recebe um conjunto parcial de alterações e devolve o perfil atualizado após a validação dos campos enviados.

Exemplo:

```json
{
  "name": "Gustavo C.",
  "username": "guhss16.cpt",
  "bio": "Colecionador de arte digital.",
  "avatarUrl": "data:image/png;base64,..."
}
```

O endpoint aceita os campos do perfil e também permite atualizar `email`, `profileName` e `referralCode`.

### Regras de validação

| Campo          | Critérios                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | Entre 2 e 60 caracteres.                                                                                                                                      |
| `username`     | Entre 3 e 30 caracteres, limitado a letras minúsculas, números, ponto e sublinhado. Deve ser único, desconsiderando diferenças entre maiúsculas e minúsculas. |
| `bio`          | Máximo de 280 caracteres.                                                                                                                                     |
| `avatarUrl`    | Aceita `null` para remoção ou uma data URL PNG/JPEG de até 512 KB. A validação é realizada pelo mock.                                                         |
| `email`        | Deve ser válido, normalizado para letras minúsculas e exclusivo entre as contas.                                                                              |
| `profileName`  | Entre 2 e 60 caracteres.                                                                                                                                      |
| `referralCode` | Até 40 caracteres alfanuméricos, espaços, `_` ou `-`. Os espaços no início e no final são removidos.                                                          |

### Respostas de erro

|  HTTP | Código             | Motivo                                                                                                                           |
| ----: | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `422` | `VALIDATION_ERROR` | Um ou mais campos não atendem às regras. A resposta inclui `fields` para identificar os erros específicos.                       |
| `409` | `CONFLICT`         | O nome de usuário ou e-mail já pertence a outra conta. O campo correspondente é indicado em `fields.username` ou `fields.email`. |
| `401` | `SESSION_EXPIRED`  | A sessão expirou durante a edição. O usuário deve ser redirecionado para o login, preservando a rota de retorno.                 |

### Remoção do avatar

Para excluir a imagem, o cliente envia `avatarUrl: null`.

Após a operação, a propriedade é removida dos dados persistidos. Tanto a resposta da atualização quanto as consultas seguintes omitem `avatarUrl`, em vez de retorná-la com valor `null`.

### Persistência

As alterações confirmadas devem continuar disponíveis após a atualização da página. Na implementação simulada, os dados são persistidos em `gm_db_v1`.

## 5. Alteração de senha

### `POST /api/profile/password`

**Autenticação:** obrigatória.

Recebe a senha atual e a nova senha desejada.

Exemplo de requisição:

```json
{
  "currentPassword": "Gustavo11011",
  "newPassword": "NovaSenha123"
}
```

Quando a operação é concluída, a API retorna `204 No Content`, sem corpo de resposta.

### Critérios de validação

A senha atual precisa corresponder à credencial cadastrada. A nova senha deve:

- Possuir pelo menos oito caracteres.
- Conter ao menos uma letra e um número.
- Ser diferente da senha atual.

|  HTTP | Código             | Motivo                                                                                                  |
| ----: | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `422` | `VALIDATION_ERROR` | Senha atual incorreta, com erro em `fields.currentPassword`, ou nova senha fora dos critérios exigidos. |
| `401` | `SESSION_EXPIRED`  | A sessão não é mais válida.                                                                             |

Após a alteração bem-sucedida, a sessão permanece ativa. Nesta versão, o token não é revogado, conforme a decisão arquitetural registrada neste documento.

## 6. Validação e acessibilidade dos formulários

Os formulários utilizam validação no cliente com Zod e também validação remota pela API. Quando o servidor retorna um erro, sua resposta prevalece sobre a validação local, evitando que a interface apresente um estado incompatível com o resultado definitivo.

Os erros devem ser associados aos respectivos campos por meio do componente `FormField`, utilizando `aria-describedby` para vincular as mensagens e `aria-invalid` para indicar campos inválidos.

### Upload de avatar

A seleção de imagem utiliza um campo de arquivo configurado para aceitar apenas PNG e JPEG:

```html
<input type="file" accept="image/png,image/jpeg" />
```

Após a seleção, a interface apresenta uma prévia da imagem. Arquivos maiores que 512 KB devem ser rejeitados localmente antes do envio, além da validação realizada pelo mock.

## 7. Integração com o formulário de pagamento

O checkout utiliza `react-hook-form`, Zod e os componentes shadcn/ui já existentes no projeto.

Os dados editáveis do formulário de pagamento também atualizam o perfil da conta. A confirmação da compra concentra a validação e o salvamento, sem exigir um botão adicional para gravar os dados separadamente.

### Campos exigidos

| Campo                  | Obrigatório | Persistência e validação                                                                                    |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| Nome de exibição       | Sim         | Atualiza `Profile.name`; entre 2 e 60 caracteres.                                                           |
| Nome de usuário        | Sim         | Atualiza `Profile.username`; entre 3 e 30 caracteres e exclusivo.                                           |
| Nome público do perfil | Sim         | Atualiza `Profile.profileName`; entre 2 e 60 caracteres.                                                    |
| E-mail                 | Sim         | Atualiza `Profile.email`; deve ser válido e único. Também passa a ser o e-mail de login.                    |
| Código de indicação    | Sim         | Atualiza `Profile.referralCode`; entre 1 e 40 caracteres no checkout, respeitando os caracteres permitidos. |

Os campos novos podem estar ausentes em contas antigas. Nesses casos, `profileName` utiliza inicialmente o valor de `name` quando ainda não houver um nome público cadastrado.

### Regras específicas do e-mail

O endereço é convertido para letras minúsculas antes de ser persistido. Se já estiver vinculado a outra conta, a API retorna `409 CONFLICT`, identificando o problema em `fields.email`.

Depois da alteração, a sessão atual permanece válida e o novo endereço deve aparecer também na resposta de `GET /auth/session`.

### Código de indicação no checkout

Embora o código seja opcional no modelo geral do perfil, seu preenchimento é obrigatório durante o checkout, com comprimento entre 1 e 40 caracteres.

Para contas sem um código cadastrado, o valor inicial utilizado no cenário de teste é `NFT Marketplace`.

O código tem finalidade informativa e não substitui um cupom de desconto. Sua validação e persistência fazem parte da ação única de confirmação da compra.

## 8. Consistência entre perfil e pedido

As informações do colecionador utilizadas na criação de um pedido são registradas no snapshot do pedido. Dessa forma, alterações posteriores no perfil não modificam os dados já associados a uma compra anterior.

Essa separação mantém o histórico do pedido consistente, enquanto as consultas de perfil continuam refletindo os dados mais recentes da conta.
