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
- Uso antecipado de World Tracking/SLAM.
- Physics engine.
- Aplicativo nativo.

## Pendências de produto

- Público-alvo e contexto de uso.
- Jornada completa de entrada e descoberta da experiência.
- Orientação portrait ou landscape.
- Modelo dos controles touch.
- Identidade visual, áudio e feedback háptico.
- Duração e regras completas da partida.
- Comportamento desejado quando o target sai do enquadramento.
- Critérios quantitativos de sucesso.
- Aparelhos e versões mínimas suportados.
- Estratégia de distribuição do Image Target.
- Compatibilidade entre eventual monetização e a licença do engine 8th Wall.
