# Referência oficial — Node.js

Última verificação: 2026-08-19. Uso e versão: **adiados até a fase 3**.

## Fontes oficiais

- [Documentação da API](https://nodejs.org/api/)
- [Variáveis de ambiente](https://nodejs.org/api/environment_variables.html)
- [TypeScript no Node.js](https://nodejs.org/api/typescript.html)
- [Test runner](https://nodejs.org/api/test.html)
- [HTTP](https://nodejs.org/api/http.html)

## Consultar antes de

- escolher a versão mínima e a linha de suporte do runtime;
- definir ESM/CJS, execução e build de TypeScript;
- escolher test runner e scripts do backend;
- configurar servidor HTTP, shutdown ou variáveis de ambiente;
- criar container, deploy ou observabilidade do servidor.

## Regras específicas do projeto

- Não criar servidor durante as fases 0, 1 e 2 sem replanejamento explícito.
- Fixe a versão de Node.js de forma reproduzível quando o scaffold for criado;
  a documentação sem versão explícita pode apontar para a release corrente.
- Segredos pertencem ao ambiente do servidor e nunca a variáveis `VITE_*`.
- O servidor futuro deve ter shutdown gracioso, validação de entradas e limites
  de recursos definidos de acordo com a hospedagem escolhida.
