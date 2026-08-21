# Relatório — laboratório A4 de tracking

Status: aguardando execução física nos dois aparelhos. Este arquivo prepara o
registro consolidado; nenhum critério está marcado como aprovado sem evidência.

## Observação que motivou o refino relativo

Em 2026-08-20, um teste Android mostrou que movimentos rápidos podiam deslocar
o campo mantido pelo SLAM. Ao reenquadrar o marcador, a segunda observação
parecia mais lenta e a divergência só era sinalizada depois de nova detecção. A
captura mostrava `Target encontrado` com o campo ainda desalinhado. A inspeção
identificou que `imageupdated` não participava da validação da âncora; o refino
lógico foi implementado, mas ainda aguarda o protocolo físico abaixo.

## Identificação

- Data:
- Build/commit:
- Responsável:
- iPhone/OS/browser:
- Android/OS/browser:
- Iluminação e montagem:
- Vídeos/capturas:
- JSONs exportados:

## Etapa 1 — targets

| Aparelho | Target | Distância | Aquisições <= 3 s | Perdas sustentadas | Reaquisição P95 | Observações |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| TBD | 150 x 200 mm | TBD | TBD | TBD | TBD | TBD |
| TBD | 195 x 260 mm | TBD | TBD | TBD | TBD | TBD |

Decisão sobre `pong-marker-v3`: TBD. Ele só deve ser criado se o gatilho de
falha descrito em `docs/testing.md` for observado.

## Etapas 2 a 4 — campo, SLAM e escala

| Aparelho | Campo/modo | Reaquisição da imagem | Realinhamento | Reâncoras auto | Erro final | Resultado |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| TBD | 1,0 m / image-only | TBD | n/a | n/a | TBD | TBD |
| TBD | 1,0 m / world-relative | TBD | TBD | TBD | TBD | TBD |
| TBD | 1,0 m / world-absolute | TBD | TBD | TBD | TBD | TBD |

## Decisão do gate

- Campo definido: 1,0 x 0,5 m; aprovação nos dois aparelhos: TBD.
- Target escolhido: TBD.
- Modo de escala escolhido: TBD.
- SLAM aprovado para o fluxo público: TBD.
- FPS e budget térmico propostos após evidência: TBD.
- Pendências e próximo experimento: TBD.
