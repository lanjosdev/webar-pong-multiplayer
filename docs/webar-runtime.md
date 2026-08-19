# Runtime WebAR e Image Tracking

## Escopo atual

Validar o 8th Wall com um Image Target antes de implementar o Pong. Este
documento não fixa APIs ou nomes de eventos do SDK até a forma de integração e
versão utilizadas serem confirmadas.

## Decisões confirmadas

- O target físico define origem, orientação e escala da experiência.
- O campo poderá ultrapassar os limites físicos do target.
- Android e iOS são plataformas prioritárias.
- World Tracking/SLAM é uma opção futura, não parte da primeira implementação.

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

## Separação de responsabilidades

- O adaptador 8th Wall converte dados do SDK para uma pose interna conhecida.
- A raiz AR posiciona o conteúdo Three.js.
- O game core não recebe ruído de tracking nem depende do target.
- UI reage aos estados do runtime, sem acessar detalhes internos do SDK.

## Casos obrigatórios de lifecycle

- Primeira abertura e carregamento lento.
- Permissão concedida ou negada.
- Target encontrado, parcialmente visível, perdido e reencontrado.
- Aplicação enviada ao background e retomada.
- Rotação ou resize do viewport conforme orientação suportada.
- Interrupção de câmera ou erro do runtime.
- Teardown e nova inicialização sem duplicar listeners ou loops.

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
- Orientação de tela.
- Integração exata do 8th Wall e ambiente de hosting.
- Condições que justificariam combinar Image Tracking e SLAM.

## Gate antes de adicionar SLAM

World Tracking/SLAM só deve ser proposto após:

1. medir o comportamento do Image Tracking isolado;
2. reproduzir uma limitação relevante ao produto;
3. comparar complexidade, estabilidade, performance e UX;
4. registrar a decisão em ADR.

