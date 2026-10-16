# NFT Marketplace

Aplicação frontend de um marketplace de NFTs desenvolvida com **React** e **TypeScript**. A aplicação funciona com mocks locais, sem integração real com blockchain ou backend, permitindo demonstrar os principais fluxos de navegação e compra de NFTs.

## Demonstração online

A aplicação estará disponível para acesso online por meio da Vercel.

**Acesse o projeto:** [frontend-challenge-theta-five.vercel.app](https://frontend-challenge-theta-five.vercel.app)

## Tecnologias

- React
- TypeScript
- Vite
- pnpm
- MSW (Mock Service Worker)
- Playwright

## Pré-requisitos

- Node.js `>=22.12`
- pnpm `10.33.2`

## Instalação e execução

Instale o pnpm na versão especificada:

```bash
npm install --global pnpm@10.33.2
```

Instale as dependências:

```bash
pnpm install --frozen-lockfile
```

Inicie o ambiente de desenvolvimento:

```bash
pnpm dev
```

Acesse a aplicação em: http://localhost:5173

## Build de demonstração

Para gerar o build com os mocks habilitados:

```bash
VITE_MOCKS=true pnpm build
```

Em seguida, inicie o servidor de preview:

```bash
pnpm preview
```

Acesse o preview em: http://localhost:4173

## Variáveis de ambiente

| Variável             | Descrição                                                                |
| -------------------- | ------------------------------------------------------------------------ |
| `VITE_MOCKS`         | Ativa os mocks durante o build quando definida como `true`.              |
| `VITE_API_BASE_URL`  | URL opcional para configurar outro servidor de API.                      |
| `VITE_MOCK_SCENARIO` | Define o cenário inicial dos mocks, como `padrao`, `lento` ou `offline`. |
| `VITE_MOCK_UI`       | Exibe o seletor de cenários no build quando definido como `1`.           |

## Credenciais de demonstração

Utilize uma das contas fictícias abaixo para testar os fluxos de autenticação.

| Usuário | E-mail              | Senha          |
| ------- | ------------------- | -------------- |
| Gustavo | `gustavo@email.com` | `Gustavo11011` |
| Gabriel | `gabriel@email.com` | `Fortnite123!` |

> **Atenção:** as credenciais são fictícias e destinadas exclusivamente à demonstração.

## Cenários de teste

A aplicação permite simular diferentes condições de funcionamento por meio de parâmetros na URL.

| Cenário              | URL                                     |
| -------------------- | --------------------------------------- |
| Funcionamento padrão | `/?scenario=padrao&reset=1`             |
| Carregamento lento   | `/?scenario=lento&reset=1`              |
| Rede offline         | `/?scenario=offline&reset=1`            |
| Erro HTTP 5xx        | `/?scenario=erro-5xx&reset=1`           |
| Pagamento recusado   | `/?scenario=pagamento-recusado&reset=1` |

O parâmetro `reset=1` reinicia o estado dos mocks para facilitar a reprodução dos cenários.

### Testes de falha

Os cenários disponíveis permitem validar o comportamento da interface diante de situações como:

- **Rede offline:** simula a indisponibilidade da conexão.
- **Erro HTTP 5xx:** simula falhas no servidor.
- **Carregamento lento:** permite verificar estados de carregamento e feedback visual.
- **Pagamento recusado:** simula a rejeição de uma transação durante o checkout.

## Comandos disponíveis

| Comando              | Descrição                                          |
| -------------------- | -------------------------------------------------- |
| `pnpm dev`           | Inicia o servidor de desenvolvimento.              |
| `pnpm build`         | Gera o build de produção.                          |
| `pnpm preview`       | Executa uma prévia local do build.                 |
| `pnpm test:contract` | Executa os testes de contrato.                     |
| `pnpm test:e2e`      | Executa os testes end-to-end com Playwright.       |
| `pnpm lighthouse`    | Executa a auditoria de performance com Lighthouse. |

## Observações

- O projeto utiliza dados simulados para demonstrar os fluxos da aplicação.
- Não há integração real com blockchain ou backend de produção.
- Os cenários de falha são destinados à validação do comportamento da interface.
- As credenciais disponibilizadas são exclusivas para testes e demonstrações.
- A demonstração online depende da publicação e configuração do projeto na Vercel.
