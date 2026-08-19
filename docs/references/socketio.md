# Referência oficial — Socket.IO

Última verificação: 2026-08-19. Uso e versão: **adiados até a fase 3**.

Socket.IO ainda é uma opção; WebSocket puro também permanece em avaliação. Este
arquivo não representa decisão de adoção.

## Fontes oficiais

- [Documentação 4.x](https://socket.io/docs/v4/)
- [Rooms](https://socket.io/docs/v4/rooms/)
- [Garantias de entrega](https://socket.io/docs/v4/delivery-guarantees)
- [Connection state recovery](https://socket.io/docs/v4/connection-state-recovery)

## Fatos que afetam a arquitetura

- A ordem das mensagens é preservada, mas a entrega padrão é no máximo uma vez.
- Garantias mais fortes exigem protocolo e persistência implementados pela
  aplicação conforme a direção da mensagem.
- A recuperação de estado ajuda em desconexões temporárias, mas pode falhar; o
  cliente ainda precisa de um caminho explícito de ressincronização.
- Rooms são um conceito do servidor e não substituem autorização ou estado
  autoritativo da partida.

## Consultar antes de

- decidir Socket.IO versus WebSocket por ADR;
- definir eventos, acknowledgements, retry ou persistência;
- implementar salas, reconnect ou ressincronização;
- configurar adapters para mais de uma instância de servidor.

## Regra da fase atual

Não instalar nem implementar Socket.IO nas fases 0, 1 ou 2 sem replanejamento
explícito solicitado pelo usuário.
