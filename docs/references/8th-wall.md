# Referência oficial — 8th Wall

Última verificação: 2026-08-19. Distribuição do projeto: engine binário `1.0.0`.

## Estado relevante da plataforma

A plataforma hospedada do 8th Wall foi encerrada em 28 de fevereiro de 2026.
Experiências já publicadas no hosting legado permanecem disponíveis somente até
28 de fevereiro de 2027. Portanto, este projeto novo não deve depender do editor,
hosting, credenciais ou fluxo de publicação da antiga plataforma hospedada.

O projeto mantém a decisão de usar 8th Wall para Image Targets. As distribuições
atuais consideradas foram:

1. **Engine Framework open source**: código sob licença MIT, com Image Targets,
   mas sem SLAM.
2. **Engine distribuído como binário**: pacote separado, com Image Targets e
   SLAM, sujeito à licença e ao modelo de distribuição do binário.

O ADR-0001 escolheu o engine binário distribuído na versão `1.0.0`. A escolha
preserva SLAM futuro, mas traz restrições de licença e atribuição. A integração
com Vite permanece pendente. Não suponha que APIs ou exemplos do produto
hospedado legado funcionem nessa distribuição.

## Fontes oficiais

- [Documentação atual](https://8thwall.org/docs)
- [Migração e datas de encerramento](https://8thwall.org/docs/migration)
- [FAQ da transição](https://8thwall.org/docs/migration/faq)
- [Visão geral e instalação do engine](https://8thwall.org/docs/engine/overview)
- [Modelo open source e diferenças entre distribuições](https://8thwall.org/docs/open-source)
- [Repositório oficial do framework](https://github.com/8thwall/8thwall)
- [README do Engine Framework](https://github.com/8thwall/8thwall/blob/main/packages/engine/README.md)
- [README do engine binário distribuído](https://github.com/8thwall/engine/blob/main/README.md)
- [Image Target CLI](https://github.com/8thwall/8thwall/blob/main/apps/image-target-cli/README.md)
- [Configuração de Image Targets](https://8thwall.org/docs/api/engine/xrcontroller/configure)
- [Guia de Image Targets](https://8thwall.org/docs/studio/guides/xr/image-targets)

## Consultar antes de

- criar o scaffold WebAR ou carregar scripts/binários do engine;
- decidir como copiar e servir artefatos pelo Vite;
- gerar, versionar ou substituir um Image Target;
- usar eventos, tipos ou opções do `XRController`;
- propor World Tracking/SLAM;
- definir hosting, licença, atribuição ou distribuição em produção.

## Regras específicas do projeto

- Use `@8thwall/engine-binary@1.0.0`; mudanças de distribuição exigem novo ADR.
- Não trate credenciais da antiga plataforma como pré-requisito do scaffold.
- Confirme licença e termos da distribuição selecionada antes de incorporar
  binários ao repositório ou ao build.
- Isole o SDK em um adaptador; o gameplay não deve depender de seus tipos.
- Faça o tracking em aparelhos reais e registre as evidências conforme
  `docs/testing.md`.
- Considere páginas de Studio apenas quando forem aplicáveis ao engine atual;
  prefira documentação do engine e os repositórios oficiais.
