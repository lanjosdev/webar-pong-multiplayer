# Briefing do produto

Origem: resumo fornecido pelo usuário em 2026-08-19.

## Visão

Criar uma experiência WebAR acessada diretamente pelo navegador de celulares,
sem instalação de aplicativo. Ao apontar a câmera para uma imagem ou símbolo
físico, o usuário vê um Pong 3D espacialmente ancorado ao marcador.

O campo pode ser consideravelmente maior do que a imagem. O Image Target atua
como referência de posição, orientação e escala, não como limite visual do jogo.

## Decisões confirmadas

- Vite como ambiente e build tool do frontend.
- TypeScript como linguagem principal.
- Three.js para renderização 3D.
- 8th Wall como solução principal de WebAR e Image Tracking.
- HTML e CSS para interface.
- Física simples própria, sem physics engine inicialmente.
- Foco em navegadores mobile Android e iOS.
- Layout responsivo em portrait e landscape, preservando a câmera como área
  principal da experiência.
- Campo do Pong definido em 1,0 x 0,5 m; campos maiores não fazem mais parte
  da experiência nem da matriz ativa de validação.
- Target físico padrão de demonstração em 195 x 260 mm.
- `world-relative` como tracking público provisório do protótipo, sem aprovação
  do gate formal da Fase 1.
- Jogador azul em `-Y`, IA vermelha em `+Y`, primeiro a 3 pontos e controle por
  arrasto relativo.
- Evolução obrigatória por fases: WebAR, Pong local e multiplayer.
- Multiplayer não faz parte das duas primeiras fases.
- Cada aparelho executará seu próprio tracking; câmera e pose AR não trafegam
  pela rede.
- Multiplayer futuro com Node.js, TypeScript e servidor autoritativo.
- Socket.IO ou WebSocket puro ainda precisa ser decidido.

## Restrição externa descoberta após o briefing

Em 2026-08-19 foi confirmado nas fontes oficiais que a plataforma hospedada do
8th Wall havia sido encerrada em 28 de fevereiro de 2026. Isso não altera a
decisão do produto de usar 8th Wall para Image Targets, mas impede depender do
editor, hosting ou credenciais do produto legado.

A distribuição escolhida é o engine binário distribuído, com Image Targets e
SLAM, conforme o ADR-0001. A integração do runtime com Vite ainda está pendente.
Consulte `docs/references/8th-wall.md`.

## Escopo funcional inicial do jogo local

- Campo/tabuleiro 3D.
- Duas raquetes.
- Bola e paredes/limites.
- Colisões simples.
- Pontuação.
- Controles touch.
- Game loop próprio.
- Estados básicos da partida.
- Interface mínima para iniciar e reiniciar.

## Objetivos da validação WebAR

- Estabilidade do tracking e jitter.
- Comportamento em diferentes distâncias e ângulos.
- Perda e recuperação do target.
- Estabilidade além das dimensões físicas da imagem.
- Desempenho em Android e iPhone.

O experimento ativo usa uma única folha A4 e o campo confirmado de
1,0 x 0,5 m, com distância operacional máxima de 1,5 m. A validação não busca
mais escolher o maior campo: deve comprovar tracking, escala e estabilidade
desse tamanho nos dois aparelhos.

## Objetivos da validação do jogo local

- Escala e posicionamento relativos ao target.
- Física, colisões e controles.
- Responsividade e integração tracking/game loop.
- FPS, comportamento térmico e consumo de recursos.
- Qualidade visual e técnica suficiente para liberar o multiplayer.

## Visão confirmada para multiplayer futuro

O servidor deve compartilhar e arbitrar, no mínimo:

- posição e velocidade da bola;
- posição das raquetes;
- inputs dos jogadores;
- colisões;
- pontuação;
- estado da partida;
- ticks e timestamps.

Prediction, interpolation, reconciliation, snapshots e reconexão serão
avaliados após medições reais de latência e instabilidade.

## Fora do escopo atual

- Servidor ou protocolo multiplayer.
- Autenticação e persistência.
- Escala horizontal do backend.
- Refinamentos profundos de tracking, novos ensaios formais e aprovação
  definitiva do SLAM para produção.
- Physics engine.
- Aplicativo nativo.

## Pendências de produto

- Público-alvo e contexto de uso.
- Jornada completa de entrada e descoberta da experiência.
- Refinamento ergonômico dos controles touch.
- Identidade visual, áudio e feedback háptico.
- Balanceamento futuro das regras da partida.
- Critérios definitivos de recuperação quando target e SLAM degradam juntos.
- Critérios quantitativos de sucesso.
- Aparelhos e versões mínimas suportados.
- Estratégia de distribuição do Image Target.
- Compatibilidade entre eventual monetização e a licença do engine 8th Wall.
