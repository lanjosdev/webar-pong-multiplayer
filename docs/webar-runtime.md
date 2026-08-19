# Runtime WebAR e Image Tracking

## Escopo atual

Validar o 8th Wall com um Image Target antes de implementar o Pong. Este
documento não fixa APIs ou nomes de eventos do SDK até a forma de integração e
versão utilizadas serem confirmadas.

## Restrição de plataforma e distribuição

A plataforma hospedada do 8th Wall foi encerrada em 28 de fevereiro de 2026.
Este projeto deve hospedar sua aplicação e usar uma distribuição atual do
engine. Antes do scaffold AR, um ADR deve escolher entre:

- Engine Framework open source, com Image Targets e sem SLAM;
- engine binário distribuído, com Image Targets e SLAM, sujeito à licença da
  distribuição.

Não use como referência de implementação APIs, credenciais ou fluxo de deploy
exclusivos da plataforma hospedada legada. Consulte
`docs/references/8th-wall.md` antes de trabalhar nesta integração.

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
- Distribuição, versão, licença e integração exata do 8th Wall com Vite.
- Forma de copiar e servir os artefatos do engine no hosting próprio.
- Condições que justificariam combinar Image Tracking e SLAM.

## Gate antes de adicionar SLAM

World Tracking/SLAM só deve ser proposto após:

1. medir o comportamento do Image Tracking isolado;
2. reproduzir uma limitação relevante ao produto;
3. confirmar que a distribuição escolhida suporta SLAM e avaliar sua licença;
4. comparar complexidade, estabilidade, performance e UX;
5. registrar a decisão em ADR.
