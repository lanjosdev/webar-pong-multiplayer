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
`LICENSE`. Confirmar também que o feed preserva seu campo de visão sem aparência
de zoom; durante a procura, o espaço externo ao canvas pode permanecer escuro
para priorizar desempenho. Registrar os modelos e versões no relatório. Essa
sessão valida o bootstrap, não Image Tracking.

Ao validar a resolução, comparar a largura visual do canvas com o viewport em
aparelhos com DPR maior que 1. O canvas pode ter backing buffer maior para
nitidez, mas não pode crescer visualmente pelo fator do DPR depois que o módulo
Three.js iniciar ou após uma rotação.

O bootstrap foi executado com sucesso nos dois sistemas conforme confirmação
do usuário em 2026-08-19. Por decisão do usuário, modelo, versão e capturas não
foram registrados; portanto esse relato não substitui a evidência exigida para
aprovar o gate de Image Tracking.

## Validação móvel do Image Target `pong-marker-v2`

Imprima `output/pdf/pong-marker-v2-a4-150x200mm.pdf` em folha A4, tamanho real ou
escala 100%, sem usar “ajustar à página”. Confirme com régua que a imagem mede
150 x 200 mm. Em cada aparelho:

1. enquadre o marcador inteiro até a HUD indicar `Target encontrado`;
2. mova o aparelho em portrait e landscape e observe posição, rotação e escala
   do plano ciano e do cubo amarelo;
3. oculte parcialmente e depois totalmente o target, verificando a mensagem de
   reenquadramento e que o objeto é ocultado;
4. reenquadre e confirme a reaquisição sem recarregar a página;
5. alterne background e foreground e confirme nova aquisição;
6. teste luz difusa, ângulos oblíquos e distâncias variadas, sem fixar ainda um
   limite quantitativo de aprovação.

### Resultado qualitativo do v1

Em 2026-08-20, o usuário informou que o target v1 impresso teve resultado
aceitável com alguma instabilidade no iPhone 14. Em um Android intermediário, a
aquisição foi lenta e o resultado geral ruim. O modelo, OS, browser, condições e
tempos exatos não foram registrados; por isso o teste orientou a criação do v2,
mas não aprova nem reprova quantitativamente o gate.

### Resultado qualitativo do v2

Em 2026-08-20, após teste físico, o usuário informou que o `pong-marker-v2`
apresentou resultado muito melhor que o v1 e o aprovou como padrão do projeto.
Esse resultado confirma a detecção do target e orienta a escolha do asset. Como
modelo e versão do Android, condições, tempos, perda, reaquisição, escala e
orientação não foram registrados, ele ainda não aprova o gate completo de Image
Tracking.

### Comparação v1 versus v2

A comparação qualitativa levou à escolha do v2 como padrão. Em novas validações,
registre tempo até o primeiro `imagefound`, perdas após movimentos leves,
reaquisição e fluidez do v2. O resultado do v1 permanece documentado como
referência histórica; seus assets não fazem mais parte do repositório ou do
build.

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
