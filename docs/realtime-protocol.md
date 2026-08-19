# Protocolo multiplayer futuro

Status: **adiado até a aprovação das fases WebAR e Pong local**.

Este documento reserva decisões e critérios. Ele não autoriza iniciar o backend
nem fixa nomes de eventos antes da fase 3.

## Decisões confirmadas

- Dois celulares participarão da mesma partida.
- Cada celular realiza Image Tracking localmente.
- Câmera e pose AR não são transmitidas.
- Node.js e TypeScript serão usados no servidor.
- O servidor será autoritativo sobre o estado compartilhado do jogo.
- Socket.IO e WebSocket puro são alternativas ainda em avaliação.

## Estado compartilhado previsto

- Inputs dos jogadores.
- Posição das raquetes.
- Posição e velocidade da bola.
- Colisões e pontuação.
- Estado da partida.
- Ticks e timestamps.

## Decisões necessárias antes da implementação

- Socket.IO versus WebSocket puro.
- Criação, descoberta e entrada em salas.
- Identidade de jogador e reassociação após reconnect.
- Autenticação, caso necessária.
- Tick rate do servidor e snapshot rate.
- Representação de tempo e estratégia de clock sync.
- Ack, retry, ordenação, idempotência e versionamento.
- Política de timeout, abandono e vitória por desconexão.
- Limites de payload, frequência e rate limiting.
- Métricas de latência e perda que justificam prediction/reconciliation.

## Princípios do contrato futuro

- Uma fonte compartilhada para nomes, payloads e schemas.
- Validação runtime de todo payload recebido pelo servidor.
- Eventos documentam direção, autoridade, ack, erros e compatibilidade.
- Clientes enviam intenção/input, não resultados autoritativos.
- Snapshots não carregam pose ou dados de câmera.
- Reconnect e duplicação devem ser casos de primeira classe.

## Template futuro de evento

| Campo | Conteúdo |
|---|---|
| Nome | TBD |
| Direção | cliente -> servidor ou servidor -> cliente |
| Payload | schema compartilhado |
| Autoridade | origem da decisão |
| Ack | obrigatório, opcional ou ausente |
| Idempotência | comportamento em repetição |
| Erros | códigos e recuperação |
| Compatibilidade | versão mínima/migração |

