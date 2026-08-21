# ADR-0003 — Protótipo local com world-relative

- Estado: Aceito
- Data: 2026-08-21
- Responsáveis: equipe do projeto

## Contexto

O refino lógico de `world-relative` foi implementado e recebeu uma primeira
avaliação física no Redmi Note 13, mas o protocolo completo da Fase 1 ainda não
foi executado. Permanecem pendentes a matriz nos dois aparelhos, os ensaios
prolongados e a validação formal de reaquisição, desempenho e ergonomia.

O projeto precisa, entretanto, avançar para um protótipo jogável de apresentação.
Esperar o encerramento de todo o gate de tracking impediria validar a integração
entre tracking, jogo local, controle e interface, sem eliminar o trabalho físico
que continuará necessário antes de produção ou multiplayer.

## Restrições e critérios

- A exceção não pode marcar a Fase 1 como aprovada.
- Multiplayer, servidor e protocolo de rede continuam adiados.
- O jogo deve congelar durante qualquer estado inseguro da âncora ou do SLAM.
- Perder somente a imagem não deve interromper uma partida com âncora alinhada e
  SLAM normal.
- O caminho experimental e os diagnósticos devem continuar disponíveis no
  laboratório, sem aparecer no fluxo público.
- A implementação deve permanecer reversível e preservar as fronteiras entre AR,
  regras, renderização, input e UI.

## Alternativas consideradas

### Encerrar todos os ensaios da Fase 1 antes do jogo

Preserva a ordem original dos gates, mas posterga a validação do produto jogável
e a preparação da apresentação. Os ensaios já indicaram informação suficiente
para uma escolha provisória, embora não para aprovação formal.

### Implementar o jogo sobre Image Tracking isolado

Reduz a dependência do SLAM, porém restaura o desaparecimento do campo quando o
marcador sai da câmera e não representa a experiência escolhida para a
demonstração.

### Abrir uma trilha excepcional de protótipo

Permite integrar o Pong local com proteções explícitas de tracking, mantém os
gates formais abertos e adia otimizações profundas até depois da apresentação.

## Decisão

Adotar provisoriamente no fluxo público de demonstração:

- `pong-marker-v2` impresso em 195 x 260 mm;
- campo fixo de 1,0 x 0,5 m;
- tracking `world-relative` com Target + SLAM;
- jogador azul na extremidade local `-Y` e IA vermelha em `+Y`;
- partida até 5 pontos, sem diferença mínima;
- arrasto relativo na faixa inferior da tela.

O módulo AR permanece proprietário da raiz ancorada e recebe o conteúdo por uma
interface com objeto Three.js, atualização, dimensões, opacidade e descarte. A
segurança do jogo depende exclusivamente de `anchorStatus === aligned` e
`worldStatus === normal`. Estados `validating`, `reanchoring`, `frozen` ou SLAM
limitado congelam imediatamente a simulação. Depois da recuperação, são exigidos
750 ms continuamente estáveis e uma contagem 3–2–1 antes da retomada.

Os modos `image-only` e `world-absolute`, o plano do target, cubos, campo de
calibração e telemetria visual permanecem exclusivos de `?trackingLab=1`.

## Consequências

- A apresentação pode usar uma partida local completa sem antecipar a rede.
- A Fase 2 possui uma trilha de protótipo implementada, mas seu gate continua
  aberto até a validação física de ergonomia e desempenho.
- A Fase 1 continua aberta e todas as evidências pendentes permanecem pendentes.
- Reancoragens encadeadas continuam sendo um risco conhecido. A janela estável de
  750 ms evita retomadas intermediárias, mas não substitui um futuro cooldown ou
  refinamento dos limites de 2 cm/2°.
- A reversão consiste em retornar o fluxo público a `image-only` ou desativar o
  conteúdo local, sem modificar o game core.

## Evidências

- Testes automatizados do game core, IA, controller local, input/UI e integração
  com o runtime AR.
- Ensaios físicos 1 e 1B no Redmi Note 13, ainda insuficientes para aprovação do
  gate formal e registrados em `docs/test-reports/tracking-lab-a4.md`.
- Decisão explícita do usuário de interromper temporariamente os refinamentos de
  tracking e preparar o protótipo para apresentação.
