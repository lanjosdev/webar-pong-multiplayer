# ADR-0001 — Distribuição do engine 8th Wall

- Estado: Aceito
- Data: 2026-08-19
- Responsáveis: equipe do projeto

## Contexto

A plataforma hospedada do 8th Wall foi encerrada. O cliente precisa usar e
hospedar uma distribuição atual do engine para Image Tracking. A escolha também
afeta a integração com Vite, licenciamento e a possibilidade futura de SLAM.

## Restrições e critérios

- Suportar Image Targets em navegadores mobile.
- Preservar a opção de avaliar World Tracking/SLAM após a fase 1.
- Permitir integração independente com Vite e Three.js.
- Não depender de credenciais ou hosting da plataforma legada.
- Tornar obrigações de licença e atribuição explícitas.

## Alternativas consideradas

### Framework open source MIT

Inclui Image Targets e permite inspecionar e modificar o código. Não inclui
SLAM e sua distribuição atual exige uma integração menos direta para este
projeto.

### Engine binário distribuído

Inclui Image Targets e SLAM e possui pacote npm próprio. O código é fechado e o
uso está sujeito ao XR Engine License Agreement, incluindo restrições de uso,
distribuição somente na forma original e obrigações de atribuição.

## Decisão

Adotar `@8thwall/engine-binary` na versão `1.0.0`. Nesta fundação, o pacote fica
instalado e versionado no lockfile, sem carregar o runtime nem copiar seus
artefatos para o build.

A próxima entrega deverá definir a cópia dos artefatos para o output do Vite,
preservando arquivos, licença e avisos originais. A inicialização ficará atrás
de um adaptador AR e não será acessada pelo game core.

## Consequências

- Image Targets podem ser implementados com o caminho de distribuição atual.
- Uma futura avaliação de SLAM não exige troca prévia de distribuição.
- O engine não pode ser modificado, submetido a engenharia reversa ou
  redistribuído fora dos termos da licença.
- Materiais e builds que usem o engine devem identificar a Niantic Spatial,
  preservar copyright, referenciar a licença e o disclaimer de garantias.
- A licença restringe determinados produtos pagos cujo valor derive inteira ou
  substancialmente do engine; eventual monetização exige revisão jurídica antes
  da produção.
- O ADR é uma decisão técnica e não representa parecer jurídico.

## Evidências

- [Distribuições e conformidade](https://8thwall.org/docs/open-source)
- [Instalação do engine](https://8thwall.org/docs/engine/overview)
- [Licença do engine binário](https://github.com/8thwall/engine/blob/main/LICENSE)
- Pacote `@8thwall/engine-binary@1.0.0` instalado e resolvido no lockfile.
