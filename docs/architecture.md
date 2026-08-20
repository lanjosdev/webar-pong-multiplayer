# Arquitetura inicial

Status: proposta inicial, sujeita a ADRs conforme o projeto evoluir.

## Objetivo arquitetural

Permitir que tracking, renderização e jogo local sejam validados de forma
independente, mantendo uma fronteira para adicionar multiplayer somente após os
gates anteriores.

## Contexto por fase

### Fase 1

```text
Câmera -> 8th Wall -> pose do Image Target -> adaptador AR -> cena Three.js
```

### Fase 2

```text
Input touch -> comandos -> game core -> estado do jogo -> renderer Three.js
                                      ^
Image Target -> adaptador AR -> transformação raiz da experiência
```

### Fase 3

```text
Cliente A ---- inputs ----> servidor autoritativo <---- inputs ---- Cliente B
Cliente A <-- snapshots -- servidor autoritativo -- snapshots --> Cliente B

Cada cliente mantém localmente: câmera, tracking AR, pose e renderização.
```

## Fronteiras lógicas propostas

- **AR/tracking**: inicialização do 8th Wall, câmera, target lifecycle e pose.
- **Game core**: estado, regras, colisões, placar e avanço determinístico.
- **Rendering**: cena Three.js e projeção visual do estado do jogo.
- **Input**: touch convertido em comandos do domínio.
- **UI**: estados da experiência, instruções, erros e controles.
- **Networking futuro**: transporte e tradução entre contratos de rede e
  comandos/snapshots do jogo.

Na implementação atual, `client/src/ar/` contém loaders do engine e do manifesto
do target, o contrato mínimo validado do SDK, o runtime de câmera e um módulo de
cena responsável apenas pela raiz rastreada e pelo objeto de referência. A UI
consome estados discriminados e intenções de lifecycle; `XR8`, eventos de pose e
Three.js não atravessam essa fronteira.

O preenchimento decorativo das áreas externas ao canvas AR reutiliza o
`MediaStream` entregue pelo engine em um vídeo independente e escurecido. Ele
fica pausado durante aquisição e recuperação do target, não solicita outra
câmera, não produz pose e é descartado junto com a sessão pelo runtime.

## Estrutura física

- `client/`: frontend Vite, com `package.json` e lockfile próprios.
- `server/`: reservado para o backend futuro, também com package próprio.
- `docs/`: requisitos, decisões, arquitetura e evidências.

A raiz não é um workspace npm. Não crie diretórios ou módulos vazios para
antecipar fases. Um pacote de contratos compartilhados só será extraído quando
a fase multiplayer justificar essa fronteira.

## Direção de dependências

- Game core não conhece Three.js, DOM, 8th Wall, Socket.IO ou Node.js.
- Renderer lê snapshots/estado renderizável; não decide regras do jogo.
- AR fornece uma transformação/pose; não controla física ou placar.
- Input produz comandos; não altera objetos Three.js como fonte primária do
  estado.
- UI orquestra intenção do usuário, mas não concentra regras de domínio.
- Networking futuro adapta contratos para o game core; não transporta pose AR.

## Estado e relógios

### Jogo local

- O game core é a fonte do estado lógico.
- O render loop e a simulação devem poder usar relógios separados.
- A transformação raiz AR posiciona a representação visual sem contaminar o
  estado lógico com ruído de tracking.

### Multiplayer futuro

- O servidor será a fonte autoritativa do estado competitivo.
- Frequência de tick, snapshots e renderização serão decisões separadas.
- Prediction ou reconciliation só entram se medições justificarem a
  complexidade.

## Lifecycle esperado

1. Carregar shell e verificar compatibilidade.
2. Explicar e solicitar acesso à câmera.
3. Inicializar runtime WebAR.
4. Carregar recursos da cena fora do render loop.
5. Aguardar e adquirir o target.
6. Ancorar a raiz visual e habilitar a interação apropriada.
7. Atualizar pose, simulação e renderização em responsabilidades distintas.
8. Tratar perda/reaquisição, pause/resume e mudança de viewport.
9. Fazer teardown de câmera, listeners, loops e recursos gráficos.

## Estratégia de evolução

- Não criar backend na fase 1 ou 2.
- Manter comandos e estado do game core serializáveis o suficiente para uma
  futura camada de rede, sem projetar todo o protocolo agora.
- Antes de adotar SLAM, registrar medições e um ADR comparando alternativas.
- Antes do multiplayer, criar um ADR para Socket.IO versus WebSocket puro.

## Decisões que exigem ADR

- Adicionar World Tracking/SLAM.
- Escolher Socket.IO ou WebSocket puro.
- Alterar autoridade do servidor.
- Adicionar physics engine.
- Introduzir framework de UI ou state manager.
- Adicionar persistência, autenticação ou infraestrutura distribuída.
- Mudar a fonte de verdade do estado do jogo.
