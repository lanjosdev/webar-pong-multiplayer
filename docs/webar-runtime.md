# Runtime WebAR e Image Tracking

## Escopo atual

Validar o 8th Wall com um Image Target antes de implementar o Pong. Este
documento não fixa APIs ou nomes de eventos do SDK até a forma de integração e
versão utilizadas serem confirmadas.

## Restrição de plataforma e distribuição

A plataforma hospedada do 8th Wall foi encerrada em 28 de fevereiro de 2026.
Este projeto deve hospedar sua aplicação e usar uma distribuição atual do
engine. O ADR-0001 escolheu `@8thwall/engine-binary@1.0.0`, com Image Targets e
SLAM, sujeito à licença da distribuição. Antes de desenvolvimento e build, os
artefatos originais são copiados para `public/external/xr`; após o build, o
inventário e os hashes SHA-256 são comparados byte a byte com o pacote instalado.

O bootstrap carrega `xr.js` pelo `BASE_URL` do Vite e pré-carrega o chunk
`slam`. A pipeline atual contém somente `GlTextureRenderer`, `XrController` e
um módulo próprio de lifecycle. `disableWorldTracking: true` é configurado antes
de criar a pipeline e executar o engine. Não há Image Target nem cena Three.js.

Não use como referência de implementação APIs, credenciais ou fluxo de deploy
exclusivos da plataforma hospedada legada. Consulte
`docs/references/8th-wall.md` antes de trabalhar nesta integração.

## Decisões confirmadas

- O target físico define origem, orientação e escala da experiência.
- O campo poderá ultrapassar os limites físicos do target.
- Android e iOS são plataformas prioritárias.
- World Tracking/SLAM é uma opção futura, não parte da primeira implementação.
- Portrait e landscape são suportados responsivamente; a rotação não é
  bloqueada.
- A câmera só é solicitada após o usuário tocar em `Iniciar experiência`.

## Estados mínimos do runtime

- `booting`: carregando shell e dependências.
- `unsupported`: aparelho/browser incompatível.
- `camera-permission`: explicação e solicitação de acesso.
- `camera-denied`: permissão ausente com orientação de recuperação.
- `searching-target`: câmera ativa, aguardando o marcador.
- `target-found`: pose válida e conteúdo disponível.
- `target-lost`: política visual ainda TBD.
- `recovering`: tentativa de reaquisição ou retomada de lifecycle.
- `fatal-error`: falha não recuperável com ação clara para o usuário.

Os nomes são conceituais; a implementação pode usar outro modelo desde que
cubra os mesmos estados observáveis.

No bootstrap atual, `camera-permission`, `camera-denied`, `unsupported`,
`recovering` e `fatal-error` já possuem representação observável. Estados de
target permanecem reservados para a entrega de Image Tracking.

## Separação de responsabilidades

- O adaptador 8th Wall converte dados do SDK para uma pose interna conhecida.
- A raiz AR posiciona o conteúdo Three.js.
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
`orientationchange` e `visualViewport` atualizam o backing buffer do canvas; os
listeners e módulos são removidos de forma idempotente.

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

## Critérios ainda TBD

- Dimensões e arte final do target.
- Unidade e escala física usadas pela cena.
- Distâncias e ângulos formais da matriz de teste.
- Limite aceitável de jitter e drift.
- Tempo máximo aceitável de aquisição e reaquisição.
- Comportamento visual ao perder o target: congelar, ocultar, suavizar ou orientar
  o usuário.
- Condições que justificariam combinar Image Tracking e SLAM.

## Gate antes de adicionar SLAM

World Tracking/SLAM só deve ser proposto após:

1. medir o comportamento do Image Tracking isolado;
2. reproduzir uma limitação relevante ao produto;
3. confirmar que a distribuição escolhida suporta SLAM e avaliar sua licença;
4. comparar complexidade, estabilidade, performance e UX;
5. registrar a decisão em ADR.
