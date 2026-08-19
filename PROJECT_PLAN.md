# Plano geral do projeto

Última atualização: 2026-08-19

Este é o painel central de progresso e gates do projeto. Detalhes de produto,
arquitetura e validação permanecem nos documentos especializados em `docs/`.

## Legenda

- `[x]` concluído e, quando aplicável, acompanhado de evidência.
- `[ ]` não iniciado ou incompleto.
- **Bloqueado**: depende de decisão, acesso ou resultado externo.
- **TBD**: decisão ainda não tomada.

## Estado atual

- Fase ativa: **Fase 0 — Fundação e decisões iniciais**.
- Próximo gate: scaffold mínimo do frontend e acesso funcional ao 8th Wall.
- Implementação multiplayer: **adiada até a aprovação das fases 1 e 2**.

## Direção do produto

Entregar uma experiência de Pong 3D no navegador mobile, espacialmente
ancorada a um Image Target, estável e utilizável em Android e iOS. A evolução
para multiplayer não deve comprometer a separação entre tracking, renderização,
gameplay e rede.

## Fase 0 — Fundação e decisões iniciais

- [x] Consolidar o briefing em `docs/product-brief.md`.
- [x] Definir instruções do projeto em `AGENTS.md`.
- [x] Documentar arquitetura inicial e fronteiras.
- [x] Documentar plano de validação WebAR e testes.
- [x] Documentar diretrizes iniciais de UX/UI.
- [x] Reservar a arquitetura multiplayer sem implementá-la.
- [ ] Definir gerenciador de pacotes e versão mínima do Node.js.
- [ ] Confirmar modelo de integração/hosting do 8th Wall.
- [ ] Obter credenciais e acesso de desenvolvimento do 8th Wall.
- [ ] Definir e disponibilizar o asset do Image Target.
- [ ] Registrar dimensões físicas e qualidade do target.
- [ ] Definir orientação inicial da experiência.
- [ ] Definir matriz mínima de aparelhos, OS e navegadores.
- [ ] Definir budgets provisórios de FPS, tempo de carregamento e memória.
- [ ] Criar scaffold mínimo do frontend.
- [ ] Configurar TypeScript estrito, lint, formatação e testes.
- [ ] Registrar comandos canônicos de desenvolvimento e validação.

### Gate de saída da fase 0

- Aplicação mínima pode ser executada em ambiente compatível com 8th Wall.
- Asset e dimensões do target são conhecidos.
- Pelo menos um Android e um iPhone de teste estão definidos.
- Comandos de instalação, desenvolvimento, build e validação estão registrados.

## Fase 1 — WebAR e Image Tracking

- [ ] Inicializar câmera e pipeline WebAR.
- [ ] Detectar o Image Target configurado.
- [ ] Posicionar um objeto de referência na origem do target.
- [ ] Validar escala e orientação das coordenadas.
- [ ] Testar objetos além dos limites físicos do target.
- [ ] Tratar target encontrado, atualizado, perdido e reencontrado.
- [ ] Tratar permissão negada, incompatibilidade e erro de inicialização.
- [ ] Implementar teardown e recuperação de lifecycle.
- [ ] Coletar evidências na matriz mínima de aparelhos.
- [ ] Medir jitter, reacquisition, FPS e comportamento térmico conforme o plano
  de testes.
- [ ] Avaliar se Image Tracking isolado é suficiente.
- [ ] Se necessário, registrar ADR antes de adicionar World Tracking/SLAM.

### Gate de saída da fase 1

- Tracking aprovado nos aparelhos definidos.
- Perda e recuperação do target têm comportamento de UX aprovado.
- Objetos fora da área do marcador permanecem aceitavelmente estáveis segundo
  critérios mensuráveis definidos durante a fase 0.
- Não há vazamentos ou degradação progressiva evidente no teste prolongado.

## Fase 2 — Pong 3D local

- [ ] Definir modelo determinístico do estado do jogo.
- [ ] Implementar campo, raquetes, bola e limites.
- [ ] Implementar game loop desacoplado do tracking e da renderização.
- [ ] Implementar colisões e pontuação sem physics engine.
- [ ] Implementar controles touch.
- [ ] Implementar estados de início, partida, ponto, fim e reinício.
- [ ] Integrar o estado lógico à cena ancorada.
- [ ] Criar testes unitários para regras e colisões.
- [ ] Validar escala, legibilidade e ergonomia em aparelho.
- [ ] Medir FPS, estabilidade e comportamento térmico em sessão prolongada.

### Gate de saída da fase 2

- O jogo local está completo e jogável em um único aparelho.
- Física, controles, pontuação e reinício têm testes e validação manual.
- Tracking e game loop não interferem indevidamente um no outro.
- Experiência visual, responsividade e desempenho foram aprovados.

## Fase 3 — Multiplayer para dois jogadores

- [ ] Confirmar Socket.IO versus WebSocket puro por ADR.
- [ ] Definir fluxo de criação/entrada em sala e identidade de jogador.
- [ ] Definir contrato versionado de eventos e schemas de runtime.
- [ ] Implementar servidor Node.js + TypeScript autoritativo.
- [ ] Separar tick do servidor, snapshots e renderização do cliente.
- [ ] Sincronizar inputs, bola, raquetes, placar e estado da partida.
- [ ] Implementar interpolação do estado remoto.
- [ ] Avaliar prediction e reconciliation com base em medições.
- [ ] Tratar disconnect, reconnect, timeout e abandono.
- [ ] Testar Wi-Fi, 4G/5G, latência, jitter e perda de pacotes.
- [ ] Validar dois aparelhos com tracking local independente.

### Gate de saída da fase 3

- Dois celulares completam partidas sem transmitir câmera ou pose AR.
- Servidor permanece autoritativo sobre estado competitivo.
- Comportamento sob latência, disconnect e reconnect está documentado e
  aprovado conforme critérios definidos antes da implementação.

## Fase 4 — Preparação para produção

- [ ] Definir hospedagem, ambientes e estratégia de deploy.
- [ ] Configurar observabilidade e tratamento de erros.
- [ ] Revisar segurança, privacidade e exposição de credenciais.
- [ ] Executar matriz final de compatibilidade mobile.
- [ ] Documentar operação, rollback e limitações conhecidas.

## Decisões abertas

1. Integração exata do 8th Wall com Vite e ambiente de hosting.
2. Asset, dimensões e condições físicas do Image Target.
3. Orientação da experiência e layout dos controles.
4. Aparelhos, versões mínimas de OS e browsers suportados.
5. Critérios numéricos para tracking, FPS, carregamento e sessão térmica.
6. Gerenciador de pacotes, Node.js e ferramentas de teste.
7. Estratégia de calibração para campo maior que o target.
8. Necessidade real de World Tracking/SLAM após medições da fase 1.
9. Socket.IO ou WebSocket puro na fase 3.
10. Fluxo de sala, identidade, reconnect e eventual autenticação.
11. Hospedagem do frontend e do servidor.
12. Identidade visual e referências de UI.

## Regra de manutenção

- Atualize este arquivo quando uma entrega alterar fase, gate ou decisão aberta.
- Marque itens somente após validação proporcional ao risco.
- Coloque resultados detalhados em `docs/testing.md`, ADRs ou relatórios; aqui
  mantenha apenas o estado executivo.
- Se o projeto adotar um issue tracker, ele passa a controlar tarefas diárias;
  este arquivo continua responsável por fases, gates e direção geral.

