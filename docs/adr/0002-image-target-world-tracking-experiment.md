# ADR-0002 — Experimento híbrido de Image Target e World Tracking

- Estado: Aceito
- Data: 2026-08-20
- Responsáveis: equipe do projeto

## Contexto

O `pong-marker-v2` em 150 x 200 mm perde tracking com mudanças lentas de
perspectiva na distância necessária para visualizar um campo grande. O modo
anterior aplicava cada pose do Image Target diretamente à raiz visual e ocultava
o conteúdo 300 ms após `imagelost`. Essa política não permite distinguir perda
da imagem de perda do tracking espacial.

O usuário solicitou um laboratório A4 para comparar campos de 1,0, 1,5 e 2,0 m,
Image Tracking isolado e a combinação com o SLAM presente na distribuição
binária escolhida pelo ADR-0001.

No primeiro teste do `world-relative`, movimentos rápidos puderam deslocar a
âncora do campo. O target voltava a ser observado, inclusive por
`imageupdated`, mas a implementação só verificava divergência em `imagefound`
após uma perda confirmada. Isso deixava a HUD e a validade da âncora em estados
inconsistentes e tornava a recuperação manual dependente de uma pose tardia.

## Restrições e critérios

- O modo normal da aplicação deve preservar Image Tracking isolado.
- O experimento deve ser opt-in e não antecipar gameplay ou multiplayer.
- O campo deve continuar ancorado após `imagelost` somente quando World Tracking
  estiver ativo.
- Reaquisições não podem produzir saltos visuais grandes.
- Escala relativa e absoluta devem ser comparáveis com a mesma telemetria.
- O gate da Fase 1 permanece aberto até existirem evidências em aparelhos reais.

## Alternativas consideradas

### Manter somente Image Tracking

É mais eficiente e simples, mas não preserva uma referência espacial quando o
target deixa de ser acompanhado. Aumentar apenas a tolerância de perda congela a
última pose sem fornecer tracking do movimento da câmera.

### Adotar World Tracking no produto imediatamente

Pode melhorar continuidade, mas adiciona custo, onboarding e dependência da
qualidade visual do ambiente antes de haver medições comparáveis.

### Laboratório híbrido opt-in

Mantém o comportamento público atual e permite medir os modos `image-only`,
`world-relative` e `world-absolute` com os mesmos campos, targets e aparelhos.

## Decisão

Adicionar um laboratório interno ativado por `?trackingLab=1`. O modo normal
continua com `disableWorldTracking: true`. No laboratório:

- `image-only` mantém o comportamento de referência;
- `world-relative` usa o target para origem e escala relativa, mantendo a raiz
  no espaço do SLAM após perda da imagem;
- `world-absolute` usa coordenadas em metros e onboarding de movimento;
- no `world-relative`, toda pose de `imagefound` ou `imageupdated` pode iniciar
  validação, sem depender de `imagelost`;
- três poses consistentes entre 150 e 600 ms confirmam a observação; a variação
  interna máxima é 1% do campo e 1 grau;
- correções confirmadas dentro de 2% do campo e 2 graus são interpoladas em
  750 ms;
- diferenças maiores no `world-relative` reancoram automaticamente, ocultando
  o campo em 150 ms e reapresentando-o em 250 ms;
- a ação manual apenas solicita nova validação e nunca aplica uma pose antiga;
- o comportamento de correção do `world-absolute` permanece experimental e
  inalterado;
- SLAM `LIMITED` por mais de 1,5 s é registrado como falha do ensaio.

A adoção de World Tracking no fluxo público dependerá dos resultados do
protocolo definido em `docs/testing.md`.

## Consequências

- Target e SLAM passam a ser observações independentes no adapter AR.
- O laboratório exporta schema v2 com amostras, timeline de eventos, tempos de
  reacisição e realinhamento, sem adicionar dependências.
- A HUD separa visibilidade do target, estado do SLAM e validade da âncora.
- O modo híbrido consome mais processamento e precisa de teste térmico real.
- A escala absoluta adiciona onboarding e não é automaticamente preferida.
- A reversão consiste em manter o laboratório desativado ou remover os modos de
  World Tracking sem alterar o game core futuro.

## Evidências

- Limitação qualitativa informada pelo usuário com o target A4 atual.
- [Image Targets com World Tracking](https://8thwall.org/docs/engine/guides/image-targets).
- [Configuração de World Tracking e escala](https://8thwall.org/docs/api/engine/xrcontroller/configure).
- [Tracking status do pipeline](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule).
- [Coaching de escala absoluta](https://8thwall.org/docs/engine/guides/coaching-overlays).

## Refinamento de escopo em 2026-08-21

O usuário confirmou 1,0 x 0,5 m como tamanho suficiente para a experiência e
retirou 1,5 x 0,75 e 2,0 x 1,0 m da matriz ativa. A decisão experimental sobre
os modos de tracking permanece válida; apenas a comparação entre tamanhos de
campo foi encerrada.
