# Referência oficial — Vite

Última verificação: 2026-08-19. Versão do projeto: `8.2.1`.

## Fontes oficiais

- [Guia](https://vite.dev/guide/)
- [Tratamento de assets estáticos](https://vite.dev/guide/assets.html)
- [Variáveis de ambiente e modes](https://vite.dev/guide/env-and-mode.html)
- [Build de produção](https://vite.dev/guide/build.html)
- [Deploy estático](https://vite.dev/guide/static-deploy)

## Consultar antes de

- criar ou atualizar o scaffold;
- decidir onde armazenar engine, wasm, binários ou arquivos de Image Target;
- alterar `base`, `publicDir`, aliases, plugins ou build targets;
- criar variáveis de ambiente ou configurar deploy;
- diagnosticar diferenças entre desenvolvimento e build de produção.

## Regras específicas do projeto

- Confirme a versão instalada e use a documentação correspondente.
- Variáveis com prefixo `VITE_` são expostas ao cliente; nunca coloque segredos
  nelas.
- A estratégia de assets do 8th Wall depende da distribuição do engine e deve
  ser validada no build final, não somente no dev server.
- A integração atual copia a árvore `dist` do pacote para
  `public/external/xr`, verifica hashes após o build e resolve `xr.js` com
  `import.meta.env.BASE_URL`.
- O acesso à câmera exige contexto seguro em aparelhos; o fluxo de teste precisa
  prever HTTPS ou ambiente equivalente compatível.
- Não adicione plugins de Vite para resolver algo suportado pela configuração
  nativa sem justificar o custo.
