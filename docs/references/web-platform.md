# Referência oficial — Web Platform

Última verificação: 2026-08-19.

MDN é a referência prática de compatibilidade e uso. Especificações W3C são a
fonte normativa quando houver dúvida de comportamento.

## Câmera e permissões

- [MDN — `getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [W3C — Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)

`getUserMedia` requer contexto seguro e permissão do usuário. A implementação
deve tratar recusa, ausência de dispositivo, restrições incompatíveis e falhas
de leitura sem assumir que toda falha tem a mesma causa.

## Lifecycle e render loop

- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

Consulte estas páginas antes de implementar pause, resume, background,
teardown ou coordenação entre tracking e renderização.

## Input e WebGL

- [MDN — Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [W3C — Pointer Events](https://www.w3.org/TR/pointerevents/)
- [Evento `webglcontextlost`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)

Use Pointer Events como base para input touch quando a matriz de aparelhos
confirmar o suporte necessário. Teste gestos, cancelamento, múltiplos toques e
interferência com scroll em aparelhos reais.

## Regras específicas do projeto

- Verifique tabelas de compatibilidade para os browsers e versões da matriz de
  testes; não presuma suporte apenas pelo nome da API.
- Não faça uma nova solicitação de câmera fora do lifecycle controlado pelo
  adaptador WebAR.
- Trate mudança de visibilidade, resize e orientação como eventos de lifecycle.
- Planeje recuperação ou mensagem clara para perda do contexto WebGL.
