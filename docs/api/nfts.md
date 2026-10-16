# Contrato de API — Catálogo e Detalhes dos NFTs

## 1. Estrutura do NFT

O objeto `Nft` concentra os dados utilizados nas páginas de catálogo e de detalhes. Algumas propriedades podem não estar presentes em registros antigos, garantindo compatibilidade com dados já persistidos.

```ts
type Nft = {
  id: string;
  name: string;
  collection: string;
  creator: {
    id: string;
    name: string;
  };
  edition: {
    current: number;
    total: number;
  };
  price: string;
  previousPrice?: string;
  network: 'ethereum' | 'polygon' | 'solana';
  categories: string[];
  image: string;
  images: string[];
  description: string;
  tokenId?: string;
  details?: string;
  contract?: {
    address: string;
    standard: string;
    verified: boolean;
    royalties: string;
  };
  reviews?: {
    average: number;
    count: number;
    items: {
      id: string;
      author: string;
      rating: number;
      comment: string;
      date: string;
    }[];
  };
  editable: boolean;
  available: number;
  favoritesCount: number;
  rarity?: 'RARO' | 'COMUM' | 'ÚNICO';
  attributes?: {
    trait: string;
    value: string;
  }[];
  version: number;
  updatedAt: string;
  createdAt: string;
};
```

### Descrição das propriedades

- `id`: identificador único do NFT, como `golden-signal-160`.
- `name` e `collection`: nome de exibição e coleção à qual o ativo pertence.
- `creator`: identifica o criador por meio de seu ID e nome.
- `edition`: informa o número da edição atual e a quantidade total de exemplares.
- `price`: preço atual em ETH, representado como string decimal.
- `previousPrice`: valor anterior, opcional e utilizado para sinalizar reduções de preço com um badge coral.
- `network`: rede associada ao NFT no catálogo. Essa informação não determina automaticamente a rede da carteira ou do checkout.
- `categories`: categorias às quais o ativo pertence.
- `image` e `images`: imagem principal e imagens complementares para a galeria. A galeria deve conter pelo menos uma imagem e utilizar as quatro imagens previstas no Figma.
- `description` e `details`: resumo e conteúdo descritivo ampliado, respectivamente. Em `details`, os parágrafos podem ser separados por `\n`.
- `tokenId`: identificador opcional do token.
- `contract`: metadados do contrato, incluindo endereço, padrão, verificação e percentual de royalties. O valor de `royalties` é apresentado sem realizar cálculos.
- `reviews`: informações agregadas das avaliações e a amostra de comentários disponíveis.
- `editable`: determina se o NFT pode ter sua quantidade alterada e ser comprado.
- `available`: número de exemplares disponíveis. O valor zero indica esgotamento.
- `favoritesCount`: total de favoritos informado pelo catálogo.
- `rarity` e `attributes`: dados opcionais sobre raridade e características do ativo.
- `version`: versão utilizada para identificar atualizações e evitar o processamento duplicado de eventos.
- `updatedAt` e `createdAt`: datas em formato ISO, sendo a última utilizada na ordenação por itens recentes.

### Regras de exibição e disponibilidade

Os campos opcionais podem ser omitidos quando não houver dados correspondentes. Se um NFT não possuir avaliações, a interface deve apresentar um estado vazio explícito quando necessário, sem inventar notas ou comentários.

Quando `editable` for `false`, o detalhe deve indicar que a edição não está disponível. Nesse estado, a alteração de quantidade e a compra ficam bloqueadas, mesmo que ainda exista estoque.

As opções de edição exibidas na interface servem apenas como informação: somente a edição vinculada ao NFT atual está disponível para seleção.

## 2. Consulta ao catálogo

### `GET /api/nfts`

**Acesso:** público.

Retorna os NFTs conforme os critérios de busca, filtros, ordenação e paginação fornecidos na URL.

### Parâmetros de consulta

| Parâmetro       | Tipo       | Padrão            | Funcionamento                                                                                                                                                             |
| --------------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`             | `string`   | Sem filtro        | Pesquisa por nome do NFT, coleção ou nome do criador, sem diferenciar maiúsculas de minúsculas. Uma busca sem correspondências retorna `200` com `items: []`.             |
| `categories`    | `string[]` | Sem filtro        | Aceita parâmetros repetidos. Quando há várias categorias, o resultado precisa corresponder a todas elas.                                                                  |
| `networks`      | `string[]` | Sem filtro        | Aceita múltiplas redes válidas (`ethereum`, `polygon` e `solana`). Os resultados podem pertencer a qualquer uma das redes selecionadas. Valores inválidos retornam `422`. |
| `minPrice`      | `string`   | Sem limite mínimo | Define o menor preço permitido em ETH, incluindo o próprio limite.                                                                                                        |
| `maxPrice`      | `string`   | Sem limite máximo | Define o maior preço permitido em ETH, incluindo o próprio limite.                                                                                                        |
| `sort`          | `enum`     | `relevance`       | Define o critério de ordenação.                                                                                                                                           |
| `page`          | `number`   | `1`               | Número da página, começando em 1.                                                                                                                                         |
| `pageSize`      | `number`   | `12`              | Quantidade de resultados por página, entre 1 e 48.                                                                                                                        |
| `favoritesOnly` | `boolean`  | `false`           | Restringe os resultados aos NFTs favoritados pelo usuário autenticado.                                                                                                    |

Os valores aceitos para `sort` são:

- `relevance`: relevância padrão.
- `recent`: itens mais recentes.
- `price_asc`: preço crescente.
- `price_desc`: preço decrescente.
- `popular`: popularidade.

O parâmetro `favoritesOnly` aceita valores booleanos ou as strings `true` e `false`. Quando omitido ou definido como `false`, o catálogo continua público. Se for `true`, é necessária uma sessão válida; caso contrário, a API responde com `401`. Valores inválidos resultam em `422 VALIDATION_ERROR`.

### Combinação dos filtros

Todos os filtros são aplicados em conjunto, seguindo a lógica AND entre os diferentes critérios. A seleção de várias redes funciona como exceção dentro do próprio filtro de rede: basta o NFT pertencer a uma das redes selecionadas.

Para categorias, a API mantém a regra AND entre as categorias recebidas. Por exemplo:

`?categories=Arte%20digital&categories=Música`

Nesse caso, o NFT precisa corresponder às duas categorias.

O filtro de favoritos é aplicado antes da ordenação e da paginação, em conjunto com os demais critérios. As facetas, por outro lado, são calculadas sobre o catálogo global, sem considerar os filtros ativos.

O preço mínimo não pode superar o máximo. Quando isso ocorrer, a API retorna `422 VALIDATION_ERROR`.

Sempre que o usuário alterar filtros ou ordenação, o cliente deve voltar à primeira página. Se a página solicitada ultrapassar o total disponível, a API retorna `items: []`, preservando o valor real de `total`.

### Formato da resposta

Uma consulta bem-sucedida retorna os registros encontrados, as facetas globais e os metadados da paginação.

```json
{
  "items": [],
  "facets": {
    "categories": [
      {
        "id": "Arte digital",
        "count": 33
      }
    ],
    "networks": [
      {
        "id": "ethereum",
        "count": 22
      }
    ]
  },
  "page": 1,
  "pageSize": 12,
  "total": 64
}
```

O exemplo é ilustrativo: `items` contém os NFTs correspondentes à consulta, enquanto os números das facetas representam contagens de referência.

A resposta pode utilizar o modelo completo de `Nft`, sem exigir a remoção de campos mais pesados.

**Erros previstos:**

- `422 VALIDATION_ERROR`: parâmetros inválidos ou combinações não permitidas.
- `500 INTERNAL`: falha interna, incluindo o cenário de erro simulado.

## 3. Consulta individual de NFT

### `GET /api/nfts/:id`

**Acesso:** público.

Busca os dados completos de um NFT pelo seu identificador.

- `200 OK`: retorna o objeto `Nft`.
- `404 NOT_FOUND`: indica que o ativo não foi encontrado.

Exemplo de erro:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "NFT não encontrado"
  }
}
```

O acesso direto à URL do detalhe deve funcionar mesmo quando o usuário não navegar pelo catálogo antes.

Se a rota não existir no mock, a aplicação apresenta sua página 404. Se o NFT tiver sido removido depois de aparecer na listagem, o detalhe deve exibir um estado vazio amigável e disponibilizar um link para retornar ao catálogo.

## 4. Dados de demonstração

O catálogo utiliza fixtures determinísticas para permitir testes consistentes de busca, filtros, paginação e exibição de detalhes.

### Volume e distribuição

- Mais de 60 NFTs, com identificadores, preços e datas fixos.
- Pelo menos cinco categorias representadas.
- Preços entre `0.02` e `12.30` ETH.
- Edições variadas, incluindo formatos como `1/10`, `1/50` e `1/1`.
- Volume suficiente para exercitar aproximadamente seis páginas de resultados.

As imagens PNG utilizadas pelo projeto possuem resolução de `1254 × 1254` e ficam em `public/assets/nft/`. Os quatro arquivos de imagem do Figma são distribuídos entre os ativos.

Os nomes de exibição seguem os padrões visuais do layout, incluindo:

- Golden Signal #160
- Sage Nomad #009
- Golden Frequency #071
- Violet Nomad #314
- Golden Beat #207

As coleções utilizadas incluem `Kurio Editions` e `Kurio Apes`.

### Avaliações de referência

Os dados de avaliações também são determinísticos, permitindo validar tanto estados preenchidos quanto cenários sem avaliações.

| NFT                    | Média | Avaliações na amostra                |
| ---------------------- | ----: | ------------------------------------ |
| `golden-signal-160`    |   4.5 | Notas 5 e 4                          |
| `sage-nomad-009`       |   5.0 | Duas avaliações                      |
| `golden-frequency-071` |   3.5 | Duas avaliações                      |
| `violet-nomad-314`     |   1.5 | Duas avaliações                      |
| `golden-beat-207`      |   0.5 | Duas avaliações, incluindo nota zero |

Cada um desses NFTs possui duas avaliações com autor, comentário e data em formato ISO.

Há ainda casos específicos para validar a ausência de dados:

- `kurio-teal-motion-008`: não inclui a propriedade `reviews`.
- `kurio-ruby-circuit-009`: possui `average: 0`, `count: 0` e `items: []`.
- Emerald Ape: mantém média `4.8` e total de `19` avaliações, embora a amostra contenha apenas duas.

O campo `count` representa o total de avaliações e pode ser superior à quantidade de comentários disponibilizados em `items`.

### Atualização das fixtures

Os registros começam com `version: 1`. Cada evento `nft.updated` incrementa a versão correspondente.

Para carregar as fixtures atualizadas em um navegador que já possui dados persistidos, utilize a opção **Reiniciar** da aplicação ou acesse a URL com o parâmetro `?reset=1`.

## 5. Facetas do catálogo

As facetas representam a distribuição de NFTs no catálogo completo e são independentes da pesquisa, dos filtros selecionados, da ordenação e da paginação.

A API deve retornar todas as nove categorias e as três redes, mesmo quando suas contagens forem zero. Se o catálogo estiver vazio, todas as contagens também devem ser zero.

Cada NFT é contabilizado uma única vez em cada categoria à qual pertence e uma única vez na rede associada.

Os valores apresentados nos exemplos são apenas ilustrativos. A interface deve utilizar os dados efetivamente retornados pela API, sem manter contagens fixas no cliente.

## 6. Comportamento dos filtros na interface

O painel de Coleções permite selecionar apenas uma categoria por vez. Ao escolher outra, a seleção anterior é substituída; ao desmarcar a categoria ativa, o filtro é removido.

Para manter a compatibilidade com URLs antigas que contenham várias categorias, o cliente normaliza esses endereços e conserva a primeira categoria não vazia.

Essa limitação existe apenas na interface: o endpoint REST continua aceitando múltiplas categorias.

A seleção de redes, por sua vez, permite múltiplas opções simultâneas. Em qualquer alteração de filtro ou ordenação, o cliente reinicia a paginação na primeira página para evitar inconsistências nos resultados exibidos.
