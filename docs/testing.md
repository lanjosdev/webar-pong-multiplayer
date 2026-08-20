# Estratégia de testes e validação

## Princípio

Automatizar regras determinísticas e integrações controláveis; validar tracking,
ergonomia, comportamento térmico e compatibilidade em aparelhos reais. Uma
simulação desktop não substitui evidência mobile WebAR.

## Comandos canônicos

Execute a partir da raiz do repositório:

- desenvolvimento: `npm --prefix client run dev`;
- build: `npm --prefix client run build`;
- typecheck: `npm --prefix client run typecheck`;
- lint: `npm --prefix client run lint`;
- testes unitários: `npm --prefix client run test`;
- modo watch: `npm --prefix client run test:watch`;
- formatação: `npm --prefix client run format:check`;
- validação completa: `npm --prefix client run check`.

O teste inicial valida montagem, conteúdo acessível e teardown idempotente do
shell. Os testes do bootstrap também validam loader, timeout, ordem da pipeline,
permissão, erros, retry, pause/resume e teardown com um engine falso. O build
compara inventário e conteúdo dos artefatos copiados com o pacote instalado.

## Validação móvel do bootstrap

Depois do build, execute em terminais separados:

```text
npm --prefix client run preview -- --port 4173 --strictPort
ngrok http --host-header=rewrite 4173
```

Em Android/Chrome e iPhone/Safari, confirmar que não há prompt antes do toque,
testar permissão concedida e negada, portrait e landscape, background/retomada,
encerramento/reinício e respostas HTTP 200 para `xr.js`, `xr-slam.js` e
`LICENSE`. Registrar os modelos e versões no relatório. Essa sessão valida o
bootstrap, não Image Tracking.

## Pirâmide por fase

### Fase 1 — WebAR

- Unitários: transformação de dados e reducers de estado do runtime, se houver.
- Integração controlada: lifecycle com adaptador/fake do SDK.
- Browser: estados da UI, viewport e erros reproduzíveis.
- Aparelho real: aquisição, jitter, perda/recovery, FPS e sessão prolongada.

### Fase 2 — Pong local

- Unitários: avanço da simulação, colisões, placar e transições de estado.
- Propriedades/invariantes: bola e raquetes respeitam limites conhecidos.
- Integração: input -> comando -> estado -> representação renderizável.
- Aparelho real: controle, escala, legibilidade, FPS e comportamento térmico.

### Fase 3 — Multiplayer

- Unitários: regras autoritativas e validação de contratos.
- Integração: dois clientes, salas, inputs, snapshots e término de partida.
- Falhas: duplicação, reordenação, latência, jitter, perda, disconnect e
  reconnect.
- Aparelhos reais: dois trackings independentes e partida completa.

## Registro de evidência manual

Para cada sessão relevante, registrar:

```text
Data:
Build/commit:
Aparelho:
OS:
Browser/versão:
Rede:
Target/condição:
Iluminação:
Duração:
Cenários executados:
Resultado:
Métricas observadas:
Vídeo/capturas:
Problemas e severidade:
```

Relatórios detalhados podem ficar em `docs/test-reports/` quando começarem os
testes. O `PROJECT_PLAN.md` deve guardar apenas o estado do gate.

## Critérios quantitativos pendentes

Antes de validar a fase 1, definir:

- FPS mínimo e alvo por classe de aparelho;
- tempo aceitável de carregamento e aquisição;
- tempo aceitável de reaquisição;
- tolerância a jitter/drift em cenários definidos;
- duração do teste térmico;
- limite de degradação ou falhas ao longo da sessão.

Não escolher esses números apenas por conveniência técnica; relacioná-los à
experiência do usuário e à matriz real de aparelhos.
