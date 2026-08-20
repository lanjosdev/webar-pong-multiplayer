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
- reaquisições dentro de 2% do comprimento do campo e 2 graus são interpoladas
  em 750 ms;
- diferenças maiores exigem recalibração explícita;
- SLAM `LIMITED` por mais de 1,5 s é registrado como falha do ensaio.

A adoção de World Tracking no fluxo público dependerá dos resultados do
protocolo definido em `docs/testing.md`.

## Consequências

- Target e SLAM passam a ser observações independentes no adapter AR.
- O laboratório exporta amostras e métricas sem adicionar dependências.
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
