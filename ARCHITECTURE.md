# Arquitetura do NFT Marketplace

Este documento descreve como o frontend organiza suas responsabilidades, mantém a sessão, consulta e atualiza dados e trata eventos em tempo real. A aplicação é uma demonstração baseada em mocks: não realiza operações reais em blockchain e não depende de um backend de produção.

Referências do projeto:

- [Contratos REST](./docs/api/README.md)
- [Mapa de rotas](./routes.md)
- [Implementação dos mocks e cenários](./src/mocks/)
- [Estilos globais e tokens](./src/styles/global.css)
- [Contrato de pedidos](./docs/api/orders.md)

## 1. Organização da aplicação

A arquitetura separa a interface, as regras de cada domínio e os mecanismos de comunicação.

```text
src/
├── routes/       Rotas, validação de parâmetros e proteção de páginas
├── features/     Interface e fluxos de cada domínio
└── lib/
    ├── http/     Cliente REST, interceptors e normalização de erros
    ├── query/    QueryClient, chaves de cache e políticas de atualização
    ├── session/  Hidratação e ciclo de vida da sessão
    └── socket/   Conexão em tempo real e tratamento de eventos

Rede simulada:
MSW handlers REST + binding de Socket.IO
```

O fluxo de dependências segue `routes → features → lib → transporte`. Componentes de interface não devem chamar Axios nem Socket.IO diretamente. A camada de mocks fica isolada do código de produto e intercepta as requisições na camada de rede, evitando acoplamento da interface à implementação de simulação.

## 2. Contratos de comunicação

### 2.1 REST

O REST é a fonte de consulta e confirmação do estado persistente simulado. As operações são acessadas por meio dos serviços e hooks do domínio, que usam o cliente HTTP centralizado.

As respostas de erro são normalizadas em `AppError`:

```ts
type AppError =
  | { kind: 'validation'; fields: Record<string, string[]> }
  | { kind: 'http'; code: ApiErrorCode; message: string; fields?: unknown }
  | { kind: 'network'; message: string }
  | { kind: 'canceled' };
```

- `validation`: apresenta erros junto aos campos correspondentes.
- `http`: utiliza o código de erro definido pelo contrato da API para escolher a mensagem e a ação apropriadas.
- `network`: apresenta estado de falha com opção de tentar novamente.
- `canceled`: representa uma requisição cancelada e não deve gerar toast ou estado de erro visível.

O interceptor HTTP converte erros do Axios para esse formato comum. Requisições GET podem ser repetidas conforme a política de cache; mutations não recebem retry automático.

### 2.2 Socket.IO

Os eventos de tempo real informam alterações em recursos já conhecidos pelo cliente. Cada evento inclui um identificador do recurso, uma versão crescente e um horário.

```ts
type NftUpdated = {
  type: 'nft.updated';
  resourceId: string;
  version: number;
  ts: string;
  payload: {
    price: string;
    available: number;
    previousPrice: string;
  };
};

type OrderUpdated = {
  type: 'order.updated';
  resourceId: string;
  version: number;
  ts: string;
  payload: {
    status: 'pending' | 'confirmed' | 'declined';
    txHash?: string;
    explorerUrl?: string;
    declineReason?: string;
  };
};
```

O evento não substitui a consulta REST: ele acelera a atualização da interface, enquanto o REST permite recuperar o estado atual depois de uma desconexão ou de uma possível perda de eventos.

## 3. Sessão e autenticação

### 3.1 Persistência e validade

A sessão de demonstração é representada por um token opaco, os dados do usuário e a data de expiração. O cliente armazena esse conjunto em `localStorage`, sob a chave `gm_session`.

- O token é emitido pelos fluxos simulados de login e cadastro.
- A validade definida pelos mocks é de duas horas.
- Na inicialização, `GET /auth/session` verifica se a sessão armazenada ainda é válida.
- Uma resposta HTTP 401 também sinaliza que a sessão não pode mais ser usada.
- Não há renovação silenciosa: quando a sessão expira, o usuário precisa autenticar-se novamente.

A hidratação da sessão é aguardável. A aplicação valida a credencial antes de liberar rotas privadas; uma falha de rede durante a validação não deve ser interpretada como autenticação bem-sucedida. Nesse caso, a credencial é mantida e a interface oferece uma nova tentativa.

### 3.2 Rotas protegidas e retorno ao fluxo

As rotas privadas usam guards em `beforeLoad`. Se não houver sessão válida, o usuário é direcionado ao login e a rota pretendida é preservada em `redirect`. Depois da autenticação, o destino é validado para aceitar somente rotas internas, evitando redirecionamentos externos indevidos.

Login e cadastro são apresentados em diálogos sobre o catálogo, inclusive quando acessados por URL direta. A navegação mantém o contexto de origem para que fechar o diálogo ou usar voltar/avançar restaure a tela anterior.

### 3.3 Isolamento, logout e visitante

As chaves de cache relacionadas a dados pessoais incluem o identificador do usuário. Isso evita reaproveitar entre contas dados de perfil, favoritos, carrinho, carteiras e pedidos.

O visitante recebe uma identidade anônima (`gm_anon_id`), enviada em `X-Anonymous-Id`. No fluxo simulado, o carrinho anônimo pode ser associado à conta no login.

Ao sair da conta ou trocar de usuário, o cliente:

1. cancela e remove queries ligadas à sessão anterior;
2. limpa `gm_session`, rascunhos privados e registro de pedido pendente;
3. remove listeners e contexto privado do socket e desconecta ou reautentica a conexão;
4. cria uma nova identidade anônima.

A limpeza local acontece mesmo que a chamada REST de logout falhe. Respostas atrasadas de uma sessão anterior não devem alterar a sessão atual.

### 3.4 Preservação do checkout

O rascunho `gm_checkout_draft` guarda apenas os dados necessários para retomar o fluxo, como usuário, carteira, rede, cupom e campos do formulário. Ele não é fonte confiável para preços, totais ou cotações.

O rascunho é validado antes de ser restaurado e permanece associado ao usuário correto. Se os dados forem inválidos, pertencerem a outra conta ou houver logout, são descartados. Na expiração, o usuário pode autenticar-se novamente e retomar o checkout com os dados compatíveis preservados.

## 4. Estado do catálogo, carrinho e checkout

### 4.1 Catálogo e filtros

Os parâmetros de busca e filtragem são validados na rota com Zod e refletidos na URL. A chave da query inclui os parâmetros serializados para que páginas, filtros, ordenação e pesquisa não compartilhem resultados indevidamente.

O catálogo solicita nove itens por página para compor a grade desktop de três colunas. Esse valor faz parte da chave de cache; o tamanho padrão definido pela API continua disponível para outros consumidores.

Os valores ETH são tratados como strings decimais nos limites da aplicação. Cálculos monetários usam `decimal.js`; não se deve converter ETH para `number` nem usar `parseFloat` ou `parseInt` para calcular preços. A cotação retornada pela API é a referência para totais e valores de pedido.

### 4.2 Carrinho

O carrinho é consultado pelo serviço do domínio e mantido no cache do TanStack Query, com chave separada por usuário. Sua política de frescor é `staleTime: 0`, pois quantidades, disponibilidade e preço podem mudar durante a compra.

Depois de adicionar, alterar ou remover um item, o cliente invalida as queries do carrinho e da cotação. O valor final exibido deve vir da cotação fornecida pela API, não de um total calculado exclusivamente na interface.

A aplicação usa versões dos recursos para impedir que respostas atrasadas sobrescrevam um estado mais recente. Em atualizações concorrentes, somente uma versão superior à já conhecida pode ser aplicada.

### 4.3 Cotação e alterações de preço

A cotação é dinâmica e é invalidada quando o carrinho muda ou quando um cupom é aplicado/removido. Se o preço de um NFT mudar durante o checkout, a interface deve comunicar a alteração e atualizar o subtotal.

A confirmação não deve prosseguir usando uma cotação desatualizada. No cenário simulado de preço alterado, a criação do pedido pode responder `409 QUOTE_STALE`; nesse caso, o usuário precisa revisar os valores e confirmar novamente.

### 4.4 Criação idempotente de pedidos

Antes do primeiro envio, o cliente gera uma chave de idempotência e registra a tentativa em `gm_pending_order`, incluindo a chave, o hash do payload e, quando disponível, o identificador do pedido. O payload original validado também é mantido para permitir a recuperação após falha de rede.

- Durante o envio, o botão de confirmação fica desabilitado e sinalizado com `aria-busy`.
- Não há repetição automática de mutations.
- Em timeout ou falha de rede, a ação manual de tentar novamente reutiliza a mesma chave.
- Em `409 IDEMPOTENCY_CONFLICT`, o cliente recupera o pedido associado à chave e informa qualquer divergência.
- Após resposta de sucesso, o cliente acompanha o pedido por evento ou consulta REST.
- O registro local é limpo quando o fluxo chega a um estado terminal ou quando o usuário descarta o fluxo.

O formulário de checkout salva primeiro as alterações de perfil e carteira necessárias, em sequência. Como não existe transação conjunta entre esses endpoints, uma falha parcial é informada sem fingir que tudo foi salvo; a nova tentativa envia apenas as alterações ainda pendentes.

## 5. Estratégia de cache

O TanStack Query centraliza cache, carregamento, refetch e invalidação. As chaves são definidas por uma factory única em `lib/query/keys.ts`.

| Tipo de dado                                     | `staleTime` | `gcTime` | Foco da janela         | Retry                                        |
| ------------------------------------------------ | ----------: | -------: | ---------------------- | -------------------------------------------- |
| Catálogo, detalhe, favoritos, perfil e carteiras |        30 s |    5 min | Refetch habilitado     | Até 2 tentativas para GET                    |
| Carrinho e cotação                               |           0 |    5 min | Refetch habilitado     | Até 2 tentativas para consultas idempotentes |
| Pedido pendente                                  |           0 |   10 min | Refetch habilitado     | Até 2 tentativas                             |
| Pedido em estado terminal                        |    Infinito |   10 min | Sem refetch automático | 1 tentativa                                  |

As tentativas de GET usam backoff exponencial. Mutations têm `retry: 0`; qualquer nova tentativa depende de uma ação explícita na interface. O modo de rede padrão é `online`.

### 5.1 Convenção das chaves

Exemplos representativos da factory:

```ts
keyFactory.nfts.all;
keyFactory.nfts.list(searchParams, userId);
keyFactory.nfts.detail(id);
keyFactory.favorites.all(userId);
keyFactory.cart(userId);
keyFactory.quote(userId, coupon);
keyFactory.order(userId, id);
keyFactory.profile(userId);
keyFactory.wallets(userId);
```

O identificador de usuário é a sessão atual ou `"anon"`. A chave das listagens inclui os parâmetros equivalentes aos da URL, serializados de forma consistente.

### 5.2 Invalidação e atualizações otimistas

| Ação                   | Tratamento do cache                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Favoritar/desfavoritar | Atualização otimista, snapshot para rollback e invalidação ao concluir                   |
| Alterar carrinho       | Invalidar carrinho e cotação                                                             |
| Aplicar/remover cupom  | Invalidar cotação                                                                        |
| Login/cadastro         | Limpar cache anterior, preparar o escopo do usuário e atualizar a autenticação do socket |
| Logout                 | Remover dados privados e limpar estado da sessão                                         |
| Editar perfil          | Invalidar perfil                                                                         |
| Alterar carteiras      | Invalidar carteiras e dados de perfil relacionados                                       |
| Criar pedido           | Registrar resposta no cache do pedido; atualizar carrinho e cotação após confirmação     |
| `nft.updated`          | Atualizar detalhe e itens correspondentes nas listas em cache                            |
| `order.updated`        | Atualizar o pedido conhecido se a versão recebida for mais recente                       |

A atualização otimista de favoritos segue a sequência cancelar queries relevantes, guardar snapshot, aplicar a alteração, restaurar o snapshot em caso de falha e invalidar ao final. Listagens filtradas por favoritos também são invalidadas para o usuário afetado.

Consultas que deixam de ser relevantes podem ser canceladas por `AbortSignal`, evitando que respostas antigas de busca ou paginação sobrescrevam os dados atuais.

## 6. Reconciliação entre REST e Socket.IO

### 6.1 Regras de aplicação de eventos

A camada de socket mantém uma única conexão no `SocketProvider`. Cada assinatura deve ter cleanup e remover seus listeners ao desmontar, trocar de sessão ou deixar de ser necessária.

O cliente aplica as seguintes regras:

1. **Versão:** aceitar somente eventos cuja `version` seja maior que a última versão aplicada para aquele recurso.
2. **Duplicatas:** ignorar eventos repetidos ou antigos.
3. **Escopo:** aplicar atualizações de pedido apenas quando o pedido pertence ao usuário autenticado e já é conhecido no cache desse usuário.
4. **REST como reconciliação:** após conectar ou reconectar, consultar novamente carrinho, cotação, listas de catálogo visíveis e pedidos pendentes.
5. **Pedido em andamento:** recuperar por `GET /orders/:id` o pedido registrado em `gm_pending_order`.
6. **Estados terminais:** `confirmed` e `declined` são tratados como estados finais para o fluxo de pedido.

Eventos e respostas REST passam pela mesma proteção de versão, evitando que uma resposta antiga substitua uma atualização mais nova recebida por socket.

### 6.2 Recuperação após desconexão

O socket pode perder eventos enquanto o cliente está offline. Por isso, a reconexão não é tratada como prova de que o cache está atualizado: ela dispara consultas REST de reconciliação.

Pedidos pendentes também são consultados periodicamente a cada três segundos. Quando o pedido chega a um estado terminal, o polling para e o resultado é mantido como snapshot, sem refetch automático por foco da janela.

Reconectar não cria pedidos nem repete mutations. A responsabilidade da reconexão é recuperar o estado, não executar novamente ações de compra.

### 6.3 Concorrência de preço durante a compra

O fluxo de referência para a mudança de preço é:

1. Um NFT presente no carrinho recebe o evento `nft.updated`.
2. A interface aplica a atualização de preço/disponibilidade e informa a mudança ao usuário.
3. A cotação é atualizada e a versão anterior deixa de ser válida.
4. Se a criação do pedido responder `409 QUOTE_STALE`, o checkout interrompe a confirmação.
5. O usuário revisa a nova cotação antes de tentar novamente.

Mensagens de alteração e erro são anunciadas por mecanismos acessíveis, como `aria-live`.

## 7. Dinheiro, quantidades e consistência

- Valores ETH são representados como strings decimais nas fronteiras da aplicação.
- Operações de soma, subtração, multiplicação e comparação usam `decimal.js`.
- Conversões binárias para `number` não devem ser usadas para cálculos monetários.
- A formatação visual varia conforme o valor: preços de cards usam duas casas para valores a partir de 1 ETH e até quatro casas para valores menores; totais podem mostrar até quatro casas.
- Quantidades são inteiras e respeitam a disponibilidade informada pelo serviço.
- Totais oficiais vêm da cotação ou do pedido retornado pela API simulada.

## 8. Experiência do usuário e acessibilidade

A interface diferencia carregamento, estado vazio, sucesso e erro; não deve mostrar sucesso antes de a operação ter sido confirmada. Erros de rede oferecem tentativa manual quando apropriado, e erros de validação são apresentados junto aos campos.

Padrões de acessibilidade:

- feedback global anunciado com `role="status"` ou `aria-live="polite"`;
- campos inválidos marcados com `aria-invalid` e associados à mensagem por `aria-describedby`;
- foco direcionado ao primeiro campo inválido após o envio;
- foco contido em diálogos e devolvido ao acionador quando fechados;
- animações respeitam `prefers-reduced-motion`;
- ações indisponíveis são explicitadas, sem simular uma navegação ou operação bem-sucedida.

## 9. Decisões visuais e diferenças em relação ao Figma

As decisões abaixo documentam adaptações de interface e limites do escopo da demonstração. Quando um frame ou recurso não estiver disponível, a interface deve manter consistência com os componentes existentes e não inventar funcionalidades de backend.

| Área                                 | Decisão aplicada                                                                                             | Motivo ou limite                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Telas mobile sem frame completo      | Reutilizar os padrões visuais das telas mobile existentes, tomando 414 px como referência                    | Manter consistência quando não há composição específica no arquivo de design |
| Ícones                               | Preferir os SVGs Iconly exportados do Figma; usar Lucide como fallback quando necessário                     | Preservar a identidade visual sem bloquear funcionalidades                   |
| Tipografia                           | Roboto Mono auto-hospedada via Fontsource                                                                    | Evitar dependência de rede para carregar a fonte                             |
| Perfil e carteiras                   | Reorganizar campos em uma coluna no mobile; manter navegação lateral e composição em duas colunas no desktop | Adaptar a hierarquia à largura disponível                                    |
| Login e cadastro                     | Usar diálogo compartilhado; em mobile, diálogo ocupa a tela com rolagem interna                              | Preservar contexto e facilitar o uso em telas estreitas                      |
| Busca e filtros do catálogo          | Manter busca acima dos filtros no desktop; disponibilizar ordenação também no mobile                         | Adequar os controles ao espaço e à navegação                                 |
| Preço                                | Utilizar entradas decimais e preservar a precisão dos valores                                                | Evitar perda de precisão e facilitar a digitação                             |
| Ações sem endpoint                   | Exibir como indisponíveis, sem fingir que funcionam                                                          | Não sugerir capacidades inexistentes na API                                  |
| Redes sociais e recuperação de senha | Indicar indisponibilidade enquanto não houver endpoints correspondentes                                      | Não simular autenticação externa ou recuperação real                         |
| Footer e páginas editoriais          | Links sem destino funcional permanecem desabilitados; ações de marketplace levam ao catálogo disponível      | Evitar navegação falsa                                                       |
| Estilo legado `Text/Primary`         | Não aplicar; títulos usam o estilo `Color/Foreground`                                                        | O estilo é tratado como legado no material de design                         |

### 9.1 Verificação visual pendente

A leitura direta dos frames pelo Figma MCP não foi possível com a permissão disponível durante a implementação. As medidas, textos e espaços de imagem foram obtidos da exportação local `docs/figma/file.json`, com reutilização dos PNGs e SVGs disponíveis no projeto. A comparação visual direta com os frames via MCP permanece pendente de acesso.

## 10. Mocks, testes e limitações

Os handlers REST e a simulação de Socket.IO são destinados ao desenvolvimento, à demonstração e aos testes. Cenários, persistência, reset, transporte simulado e integração com Playwright ficam implementados em `src/mocks/` e `tests/`.

Os testes visuais de `tests/e2e/visual-regression.spec.ts` guardam baselines
Playwright para catálogo, detalhe, carrinho e checkout, em desktop e mobile.
Atualize-os intencionalmente com `pnpm test:visual -- --update-snapshots`.
Esses baselines detectam regressões em relação ao estado versionado, mas não
substituem a comparação com os frames oficiais do Figma.

`pnpm lighthouse` cria um build de produção com mocks, serve-o localmente e
executa três medições sequenciais para catálogo e detalhe, nos perfis mobile e
desktop. Cada execução salva os relatórios JSON/HTML individuais e as medianas
em um subdiretório timestamped de `audits/reports/lighthouse/`, preservando
resultados anteriores mesmo se uma execução for interrompida.

Limitações conhecidas:

- não há conexão real com blockchain, assinatura real de carteira ou transação on-chain;
- a autenticação e as respostas de API são simuladas;
- o token é opaco e não existe refresh token;
- o Socket.IO é simulado por MSW e está sujeito às limitações documentadas para esse ambiente;
- funcionalidades sem endpoint — como recuperação real de senha, login social, newsletter e páginas editoriais — não são apresentadas como operações funcionais;
- diferenças de layout e verificações visuais pendentes estão registradas na seção de decisões visuais.

## 11. Princípios para manutenção

Ao evoluir o projeto:

1. Mantenha chamadas HTTP e Socket.IO fora dos componentes de interface.
2. Atualize os contratos e os mocks junto com qualquer mudança de payload ou evento.
3. Inclua o usuário nas chaves de cache de dados privados.
4. Proteja atualizações REST e Socket.IO contra respostas fora de ordem usando versões.
5. Não aplique retry automático a mutations, especialmente à criação de pedidos.
6. Trate os valores retornados pela API simulada como referência para cotação e pedido.
7. Registre novas limitações, decisões de UX e diferenças do Figma nesta documentação.
