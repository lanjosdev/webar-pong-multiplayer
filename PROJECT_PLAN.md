# Plano geral do projeto

Última atualização: 2026-08-21

Este é o painel central de progresso e gates do projeto. Detalhes de produto,
arquitetura e validação permanecem nos documentos especializados em `docs/`.

## Legenda

- `[x]` concluído e, quando aplicável, acompanhado de evidência.
- `[ ]` não iniciado ou incompleto.
- **Bloqueado**: depende de decisão, acesso ou resultado externo.
- **TBD**: decisão ainda não tomada.

## Estado atual

- Trilha ativa: **Fase 2 — protótipo local para apresentação**, pela exceção
  registrada no ADR-0003.
- Gates formais: **Fase 1 aberta** e **Fase 2 aberta**; a implementação jogável
  não substitui as validações físicas pendentes.
- Próximo marco: smoke test da partida completa no Redmi Note 13 em portrait e
  landscape, incluindo perda do target, pausa/retomada e reinício.
- Implementação multiplayer: **adiada até a aprovação das fases 1 e 2**.

O engine binário já é copiado e verificado no build. O bootstrap de câmera e
lifecycle foi executado com sucesso em Android e iPhone conforme validação
manual informada pelo usuário; o registro detalhado de evidências foi
dispensado. O primeiro teste físico do `pong-marker-v1` foi aceitável, porém
instável, no iPhone 14 e teve aquisição lenta e resultado ruim em um Android
intermediário. Em teste físico, o `pong-marker-v2` 3:4, com detalhes mais
distribuídos, apresentou resultado qualitativamente muito melhor e foi
confirmado pelo usuário como o target padrão. A avaliação do v1 permanece
documentada, mas seus assets foram removidos. A detecção física do v2 e a
presença do objeto Three.js foram confirmadas, mas o gate de tracking continua
aberto até validar escala, orientação, perda, reaquisição e estabilidade.

Após observar que o v2 ainda perde tracking à distância e com mudanças lentas
de perspectiva, o usuário definiu um experimento com uma folha A4 e distância
operacional máxima de 1,5 m. A comparação inicial incluía campos de 1,0 a
2,0 m; em 2026-08-21, o usuário confirmou 1,0 x 0,5 m como suficiente e retirou
os tamanhos maiores do escopo. O laboratório opt-in, dois PDFs A4 maximizados,
telemetria exportável e o protótipo híbrido com SLAM foram implementados. Isso
não aprova World Tracking nem o gate: faltam os ensaios físicos comparáveis nos
dois aparelhos.

O primeiro teste Android do `world-relative` revelou uma divergência não
detectada quando o engine retomava o target por `imageupdated`. O laboratório
agora pode validar novas poses de `imagefound` ou `imageupdated` com três
amostras consistentes, reancora automaticamente diferenças grandes e exporta
timeline schema v2. O refino está automatizado, mas sua aprovação continua
dependente de dez recuperações rápidas e três ensaios normais de 2 min no
aparelho real.

O hardening do protótipo agora invalida tracking antigo após pause, retry, stop
ou nova sessão, exige pose e SLAM `NORMAL` novos antes da retomada, mantém
dimensões brutas fora do campo até a calibração ser aceita e remove clonagem e
serialização do loop por frame do Pong. A cobertura automatizada foi ampliada;
o comportamento físico e térmico continua pendente nos aparelhos reais.

Para preparar a apresentação, o ADR-0003 abriu uma trilha excepcional da Fase 2.
O fluxo público adota provisoriamente o target de 195 x 260 mm, campo de
1,0 x 0,5 m e `world-relative`. O Pong local está implementado com controle por
arrasto, IA e proteção de tracking. Essa escolha é reversível e não encerra os
gates de tracking, desempenho ou ergonomia.

### Restrição externa confirmada

A plataforma hospedada do 8th Wall foi encerrada em 28 de fevereiro de 2026.
Este projeto novo deve integrar e hospedar uma distribuição atual do engine;
não pode depender do editor, hosting ou credenciais da plataforma legada. O
engine binário distribuído foi escolhido no ADR-0001 e sua integração com Vite
e hosting próprio está concluída.

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
- [x] Catalogar fontes oficiais das tecnologias em `docs/references/`.
- [x] Definir npm 11.6.0 e Node.js 24.19.0 para o toolchain do cliente.
- [x] Escolher por ADR: framework open source do 8th Wall ou engine binário
  distribuído.
- [x] Revisar licença e obrigações de atribuição do engine escolhido.
- [x] Definir e validar a cópia dos artefatos e avisos do engine no build.
- [x] Definir integração do engine escolhido com Vite e hosting próprio.
- [x] Definir e disponibilizar o asset do Image Target.
- [x] Registrar dimensões físicas e qualidade do target.
- [x] Suportar portrait e landscape com layout responsivo, sem bloquear rotação.
- [ ] Definir matriz mínima de aparelhos, OS e navegadores.
- [ ] Definir budgets provisórios de FPS, tempo de carregamento e memória.
- [x] Criar scaffold mínimo do frontend em `client/`.
- [x] Configurar TypeScript estrito, lint, formatação e testes.
- [x] Registrar comandos canônicos de desenvolvimento e validação.
- [ ] Confirmar compatibilidade da licença do engine com eventual modelo de
  monetização antes da produção.

### Gate de saída da fase 0

- Distribuição, licença e integração do engine 8th Wall estão documentadas.
- Aplicação mínima pode ser executada em ambiente próprio compatível com o
  engine escolhido.
- Asset e dimensões do target são conhecidos.
- Pelo menos um Android e um iPhone de teste estão definidos.
- Comandos de instalação, desenvolvimento, build e validação estão registrados.

## Fase 1 — WebAR e Image Tracking

- [x] Inicializar câmera e pipeline WebAR.
- [x] Detectar o Image Target `pong-marker-v2` em aparelho real.
- [x] Posicionar um objeto de referência na origem do target em implementação
  controlada; presença visual confirmada qualitativamente em aparelho, com
  escala e orientação ainda pendentes.
- [ ] Validar escala e orientação das coordenadas.
- [ ] Testar objetos além dos limites físicos do target.
- [x] Tratar target encontrado, atualizado, perdido e reencontrado em código;
  comportamento real ainda precisa ser aprovado.
- [x] Tratar permissão negada, incompatibilidade e erro de inicialização.
- [x] Implementar teardown e recuperação de lifecycle.
- [ ] Coletar evidências na matriz mínima de aparelhos.
- [ ] Medir jitter, reacquisition, FPS e comportamento térmico conforme o plano
  de testes.
- [ ] Avaliar se Image Tracking isolado é suficiente.
- [x] Criar laboratório opt-in com campo de 1,0 x 0,5 m, seleção de target,
  distância, modo e exportação JSON; tamanhos maiores foram retirados por
  decisão de produto em 2026-08-21.
- [x] Gerar PDFs A4 de 195 x 260 mm e fallback de 180 x 240 mm para comparação
  com o baseline de 150 x 200 mm.
- [x] Registrar ADR-0002 e implementar os protótipos `world-relative` e
  `world-absolute`; o ADR-0003 promoveu depois o relativo ao fluxo público
  provisório.
- [x] Refinar `world-relative` com validação de `imagefound`/`imageupdated`,
  reancoragem automática, estados independentes da âncora e telemetria v2.
- [x] Invalidar tracking entre sessões e após background, exigindo nova pose e
  novo SLAM normal antes de liberar a retomada.
- [x] Separar pose observada de calibração aceita para impedir que amostras não
  confirmadas redimensionem o campo.
- [ ] Validar o refino relativo em dez recuperações rápidas e três ensaios
  normais de 2 min no Android que reproduziu a divergência.
- [ ] Executar a matriz A4 e decidir se o modo híbrido deve ser adotado no fluxo
  público.

### Gate de saída da fase 1

- Tracking aprovado nos aparelhos definidos.
- Perda e recuperação do target têm comportamento de UX aprovado.
- Objetos fora da área do marcador permanecem aceitavelmente estáveis segundo
  critérios mensuráveis definidos durante a fase 0.
- Não há vazamentos ou degradação progressiva evidente no teste prolongado.

## Fase 2 — Pong 3D local

- [x] Definir modelo determinístico do estado do jogo.
- [x] Implementar campo, raquetes, bola e limites.
- [x] Implementar game loop desacoplado do tracking e da renderização.
- [x] Implementar colisões e pontuação sem physics engine.
- [x] Implementar controles touch.
- [x] Implementar estados de início, partida, ponto, fim e reinício.
- [x] Integrar o estado lógico à cena ancorada.
- [x] Criar testes unitários para regras e colisões.
- [x] Remover clonagem de snapshots e serialização JSON do loop por frame,
  preservando snapshots imutáveis fora do caminho quente.
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

1. Evidência mobile do bootstrap WebAR e da retomada de lifecycle.
2. Condições de impressão, iluminação e durabilidade do Image Target em uso.
3. Refinamento ergonômico do controle por arrasto relativo.
4. Aparelhos, versões mínimas de OS e browsers suportados.
5. Critérios numéricos para tracking, FPS, carregamento e sessão térmica.
6. Resultado da validação do campo de 1,0 x 0,5 m nas escalas relativa e
   absoluta.
7. Aprovação definitiva ou reversão do World Tracking/SLAM adotado
   provisoriamente pelo ADR-0003.
8. Socket.IO ou WebSocket puro na fase 3.
9. Fluxo de sala, identidade, reconnect e eventual autenticação.
10. Hospedagem do frontend e do servidor.
11. Identidade visual e referências de UI.
12. Compatibilidade do modelo de monetização com a licença do engine binário.

## Regra de manutenção

- Atualize este arquivo quando uma entrega alterar fase, gate ou decisão aberta.
- Marque itens somente após validação proporcional ao risco.
- Coloque resultados detalhados em `docs/testing.md`, ADRs ou relatórios; aqui
  mantenha apenas o estado executivo.
- Se o projeto adotar um issue tracker, ele passa a controlar tarefas diárias;
  este arquivo continua responsável por fases, gates e direção geral.
