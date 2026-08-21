# Relatório — laboratório A4 de tracking

Status: aguardando execução física nos dois aparelhos. Este arquivo prepara o
registro consolidado; nenhum critério está marcado como aprovado sem evidência.

## Evidência parcial — ensaios 1 e 1B

Em 2026-08-21, o usuário executou `world-relative` no Redmi Note 13, Android 15,
Chrome 145, em portrait, com gravação 720p/30 FPS. No ensaio 1 informou que não
foi necessário tocar em `Buscar nova calibração` e que não apareceu `Tracking
limitado`. Iluminação e resultado percebido não foram preenchidos.

No ensaio 1B, o aparelho permaneceu parado nos 10 segundos iniciais e o usuário
não percebeu `Tracking limitado`. As quantidades de perdas e reancoragens não
foram contadas, e o campo “Terminou com Target e campo alinhados?” permaneceu
ambíguo como “sim/não”. As evidências externas foram fornecidas como
`ensaio-01-world-relative.json/.mp4` e
`ensaio-01b-world-relative.json/.mp4`; não foram incorporadas ao repositório.

Esses dados sustentam somente a escolha provisória do ADR-0003. Eles não
completam dez recuperações, três ensaios normais de 2 min, matriz em iPhone,
medição de FPS/térmica ou critérios de jitter e drift; por isso o gate continua
aberto.

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
- Android/OS/browser: Redmi Note 13 / Android 15 / Chrome 145 (parcial)
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
- Target escolhido provisoriamente para demonstração: 195 x 260 mm.
- Modo provisório do protótipo: `world-relative`.
- SLAM aprovado definitivamente para o fluxo público: não; exceção do ADR-0003.
- FPS e budget térmico propostos após evidência: TBD.
- Pendências e próximo experimento: TBD.
