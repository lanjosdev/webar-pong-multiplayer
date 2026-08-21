# ADR-0004 — Histerese e continuidade do tracking

- Estado: Aceito
- Data: 2026-08-21
- Responsáveis: equipe do projeto

## Contexto

O protótipo público do ADR-0003 tratava qualquer evento `LIMITED` e qualquer
pose divergente ainda não confirmada como falha imediata. Em aparelhos reais,
oscilações breves do SLAM e ruído de reaquisição interrompiam a partida mesmo
quando o campo permanecia visualmente estável. Cada recuperação ainda impunha
750 ms estáveis e uma nova contagem 3–2–1, ampliando o custo percebido.

O estado cru do engine é útil para diagnóstico, mas não representa sozinho a
segurança efetiva do jogo. Da mesma forma, uma observação candidata não deve
alterar a âncora aceita nem suspender a simulação antes de ser confirmada.

## Restrições e critérios

- Preservar `world-relative`, `pong-marker-v2`, o campo de 1,0 x 0,5 m e as
  regras atuais do Pong.
- Não mascarar perda sustentada de tracking ou uma divergência grande
  confirmada.
- Manter os limites provisórios de 2 cm/2 graus e três poses consistentes até
  os ensaios físicos produzirem dados para recalibração.
- Não alterar multiplayer, protocolo ou backend.
- Manter lifecycle e ownership de timers, correções e recursos explícitos.

## Alternativas consideradas

### Pausar em todo evento cru

É conservador, mas transforma oscilações transitórias do SDK em interrupções
visíveis e faz uma pose ainda não confirmada afetar o domínio do jogo.

### Aumentar apenas os limites geométricos

Poderia reduzir reancoragens, porém ocultaria a causa sem evidência física e não
resolveria interrupções provocadas por `LIMITED` breve ou pelo lifecycle.

### Derivar confiança e aplicar correções em janelas seguras

Mantém telemetria crua, acrescenta histerese temporal e separa validação de pose
da âncora aceita. Exige mais estados explícitos, mas permite testar a política
sem depender do SDK.

## Decisão

Manter `worldStatus` como observação crua e derivar `worldConfidence`:
`unavailable`, `healthy`, `degraded` e `unsafe`. O primeiro `LIMITED` depois de
`NORMAL` entra em `degraded` e continua seguro. Somente 500 ms contínuos tornam
o estado `unsafe`; 1,5 s contínuos ainda congelam a âncora. `NORMAL` cancela os
dois timers. Pause, retry, stop, background ou nova sessão voltam a
`unavailable` e descartam candidatos e correções.

Poses divergentes alimentam uma janela de três amostras sem retirar a âncora de
`aligned`. Uma confirmação pequena gera uma correção pendente, substituível por
uma confirmação mais recente e cancelável por três amostras que retornem ao
deadband. O Pong autoriza a interpolação de 750 ms apenas em `ready`, `finished`
ou no início de `point` quando restarem pelo menos 750 ms. Uma diferença grande
confirmada cancela a correção pendente, entra em `reanchoring` e usa a transição
de opacidade existente. Outros conteúdos ancorados permitem correção imediata
por padrão e podem restringi-la com `canApplyAnchorCorrection()`.

O estado público do Pong contém segurança e `trackingPauseCause`: `world`,
`anchor` ou `lifecycle`. Uma pausa exclusivamente mundial exige 750 ms estáveis
e mostra “Retomando” por 1 s. Reancoragem e lifecycle exigem 750 ms estáveis e
retomada 3–2–1. Uma causa `anchor` ou `lifecycle` promove uma pausa iniciada por
`world`. Interrupções em `countdown` reutilizam ou reiniciam a contagem do core;
em `point`, aguardam o próximo countdown normal.

O perfil padrão continua `standard`. `?performanceProfile=minimal` remove o
vídeo decorativo, desabilita `backdrop-filter` sobre a câmera e limita o DPR do
canvas a 1,0 para comparação física. O laboratório exporta schema v3 com
intervalos `degraded`/`unsafe`, resultado das validações e correção pendente.

## Consequências

- Oscilações inferiores a 500 ms deixam de interromper uma partida.
- Uma pose não confirmada deixa de contaminar a segurança ou a calibração
  aceita.
- Perdas sustentadas, lifecycle e reancoragens grandes continuam conservadoras.
- A política ganha timers e estados adicionais, cobertos por testes e
  telemetria; os números ainda precisam de validação no Redmi Note 13 e iPhone
  14.
- O perfil `minimal` só poderá virar padrão após o protocolo A/B; em empate,
  `standard` permanece.

## Evidências

- Testes automatizados de debounce, congelamento, cancelamento e aplicação de
  correções, política de retomada, lifecycle, aquisição e perfis de desempenho.
- `npm --prefix client run check` aprovado com 75 testes, TypeScript estrito,
  ESLint, build de produção e verificação dos 13 artefatos XR.
- Os gates WebAR e Pong permanecem abertos até a evidência física definida em
  `docs/testing.md` e `docs/test-reports/tracking-lab-a4.md`.
