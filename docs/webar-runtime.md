# Runtime WebAR e Image Tracking

## Escopo atual

Validar o 8th Wall com um Image Target antes de implementar o Pong. O adapter
usa as APIs e eventos confirmados para `@8thwall/engine-binary@1.0.0`;
alterações de versão exigem nova consulta às fontes oficiais.

## Restrição de plataforma e distribuição

A plataforma hospedada do 8th Wall foi encerrada em 28 de fevereiro de 2026.
Este projeto deve hospedar sua aplicação e usar uma distribuição atual do
engine. O ADR-0001 escolheu `@8thwall/engine-binary@1.0.0`, com Image Targets e
SLAM, sujeito à licença da distribuição. Antes de desenvolvimento e build, os
artefatos originais são copiados para `public/external/xr`; após o build, o
inventário e os hashes SHA-256 são comparados byte a byte com o pacote instalado.

O bootstrap carrega `xr.js` pelo `BASE_URL` do Vite e pré-carrega o chunk
`slam`. A pipeline registra, nesta ordem, `GlTextureRenderer`, `XrController`,
`Threejs`, o módulo local do target e o módulo de lifecycle.
No modo público, `disableWorldTracking: true` e o `imageTargetData` são
configurados antes de criar a pipeline e executar o engine. O laboratório
opt-in `?trackingLab=1`, aceito pelo ADR-0002, também pode iniciar os modos
`world-relative` e `world-absolute`; essa escolha ocorre antes de criar a
pipeline e não muda durante uma sessão. `Threejs` não renderiza uma segunda
textura de câmera; o feed permanece responsabilidade de `GlTextureRenderer`.

Não use como referência de implementação APIs, credenciais ou fluxo de deploy
exclusivos da plataforma hospedada legada. Consulte
`docs/references/8th-wall.md` antes de trabalhar nesta integração.

## Decisões confirmadas

- O target físico define origem, orientação e escala da experiência.
- O campo poderá ultrapassar os limites físicos do target.
- Android e iOS são plataformas prioritárias.
- World Tracking/SLAM permanece fora do fluxo público e existe como protótipo
  mensurável somente no laboratório da Fase 1.
- Portrait e landscape são suportados responsivamente; a rotação não é
  bloqueada.
- A câmera só é solicitada após o usuário tocar em `Iniciar experiência`.
- O canvas preserva a proporção reportada pelo vídeo e usa o maior retângulo
  contido no viewport, evitando o recorte que pareceria zoom e reduziria o campo
  de visão necessário para enquadrar o target. Depois da aquisição, o espaço
  restante recebe uma cópia decorativa ampliada e escurecida do mesmo
  `MediaStream`; ela permanece pausada durante procura/recuperação, não abre
  outra câmera e não participa do tracking ou da renderização AR.
- `XR8.Threejs` chama `WebGLRenderer.setSize()` com atualização de estilo e tenta
  aplicar as dimensões do backing buffer ao tamanho visual do canvas. O runtime
  mantém o backing buffer em alta resolução, enquanto propriedades CSS
  protegidas preservam o tamanho lógico calculado e evitam ampliação pelo DPR.
- O target padrão confirmado é `pong-marker-v2`, planar, 3:4 e impresso em
  150 x 200, 195 x 260 ou 180 x 240 mm numa folha A4 em escala 100%; papel
  fosco e base rígida são recomendados. O teste
  físico qualitativo apresentou resultado muito melhor que o v1. O resultado
  anterior permanece documentado, mas os assets do v1 foram removidos do
  repositório e do build.
- O backing buffer de renderização usa no máximo DPR 1,5 para reduzir pressão de
  GPU sem alterar o tamanho CSS nem o campo de visão do feed. Esse limite é uma
  otimização provisória, não um budget de aceitação.

## Estados mínimos do runtime

- `booting`: carregando shell e dependências.
- `unsupported`: aparelho/browser incompatível.
- `camera-permission`: explicação e solicitação de acesso.
- `camera-denied`: permissão ausente com orientação de recuperação.
- `searching-target`: câmera ativa, aguardando o marcador.
- `target-found`: pose válida e conteúdo disponível.
- `target-lost`: perda confirmada após tolerância de 300 ms. No modo público e
  em `image-only`, o conteúdo é ocultado. Nos modos híbridos, a geometria
  permanece na âncora mundial e a observação do target muda para `lost`.
- `recovering`: tentativa de reaquisição ou retomada de lifecycle.
- `fatal-error`: falha não recuperável com ação clara para o usuário.

Os nomes são conceituais; a implementação pode usar outro modelo desde que
cubra os mesmos estados observáveis.

Todos esses estados possuem representação observável. Lifecycle da sessão e
observações de tracking são canais separados, permitindo representar target
perdido, SLAM normal e campo ainda visível simultaneamente.

## Separação de responsabilidades

- O adaptador 8th Wall converte dados do SDK para uma pose interna conhecida.
- A raiz AR posiciona o conteúdo Three.js.
- O laboratório recebe snapshots independentes de pose, visibilidade do target,
  status do SLAM, FPS e cantos do campo; a UI não acessa o SDK.
- O game core não recebe ruído de tracking nem depende do target.
- UI reage aos estados do runtime, sem acessar detalhes internos do SDK.

O SDK global é tratado como `unknown` e validado no loader. A UI recebe somente
uma união discriminada de estados e intenções de iniciar, tentar novamente e
encerrar. Tipos e chamadas do `XR8` ficam confinados em `client/src/ar/`.

## Casos obrigatórios de lifecycle

- Primeira abertura e carregamento lento.
- Permissão concedida ou negada.
- Target encontrado, parcialmente visível, perdido e reencontrado.
- Aplicação enviada ao background e retomada.
- Rotação ou resize do viewport conforme orientação suportada.
- Interrupção de câmera ou erro do runtime.
- Teardown e nova inicialização sem duplicar listeners ou loops.

O bootstrap pausa o engine em `visibilitychange` ao ir para background, retoma
ao voltar ao primeiro plano e usa `stop()` no encerramento. Resize,
`orientationchange`, `visualViewport` e mudanças nas dimensões do vídeo
recalculam o canvas contido e seu backing buffer; os listeners e módulos são
removidos de forma idempotente. O vídeo decorativo é criado em `onAttach`, usa o
stream já fornecido pelo engine, só reproduz após `imagefound` e é pausado,
desconectado e removido no teardown. Uma perda do target só é publicada após
300 ms; `imagefound` ou `imageupdated` nesse intervalo cancela a perda
transitória. Nos modos híbridos, a raiz permanece ancorada no espaço mundial.
Uma reaquisição com diferença de até 2% do campo e 2 graus é interpolada em
750 ms; diferenças maiores exigem recalibração. SLAM `LIMITED` por mais de
1,5 s cancela qualquer correção em andamento, bloqueia recalibração, orienta o
reenquadramento e é registrado como falha do ensaio.

## Laboratório de tracking

`?trackingLab=1` habilita identificação do aparelho e seletores para target físico, campo, distância,
cenário e os modos `image-only`, `world-relative` e `world-absolute`. A
configuração fica bloqueada durante uma sessão. Ensaios podem ser iniciados e
finalizados sem recarregar; o resultado é exportado em JSON com amostras brutas
e métricas derivadas.

Os campos são apenas geometria de calibração 2:1: 1,0 x 0,5 m, 1,5 x 0,75 m e
2,0 x 1,0 m. O modo relativo dimensiona a geometria pela proporção entre o
target físico declarado e a geometria reportada pelo engine. O modo absoluto
usa metros e orienta o usuário a mover o aparelho lentamente para frente e para
trás enquanto a escala é estimada.

## Matriz de validação do tracking

Para cada aparelho selecionado, registrar:

- modelo, OS, browser e versão;
- iluminação e condição física do target;
- distância e ângulo aproximados;
- tempo de aquisição e reaquisição;
- jitter observado com conteúdo próximo e distante do target;
- comportamento quando o target está parcial ou totalmente fora da câmera;
- FPS e duração da sessão;
- aquecimento, throttling ou falhas observadas;
- gravação ou captura quando possível.

## Critérios definidos para o experimento

- Distâncias operacionais: 0,75, 1,0, 1,25 e 1,5 m; 2,0 m é diagnóstico.
- Aquisição: pelo menos 9 de 10 em até 3 s.
- Jitter P95 nos extremos: até 1% do comprimento do campo.
- Drift acumulado: até 2% do comprimento do campo.
- Reaquisição: cinco tentativas em até 2 s, sem salto visual.
- O maior campo deve caber com 5% de margem a no máximo 1,5 m.

FPS mínimo, budget térmico e duração final de produção continuam TBD; o ensaio
de 10 minutos coleta a evidência necessária para defini-los.

## Gate para adotar SLAM no fluxo público

O protótipo foi autorizado pelo usuário e documentado no ADR-0002 após a
limitação qualitativa ser reproduzida. A adoção no fluxo público ainda exige:

1. medir o comportamento do Image Tracking isolado;
2. reproduzir uma limitação relevante ao produto;
3. confirmar que a distribuição escolhida suporta SLAM e avaliar sua licença;
4. comparar complexidade, estabilidade, performance e UX;
5. registrar a decisão em ADR.
