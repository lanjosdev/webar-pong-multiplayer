# Referência oficial — TypeScript

Última verificação: 2026-08-19. Versão do projeto: **TBD**.

## Fontes oficiais

- [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Referência do TSConfig](https://www.typescriptlang.org/tsconfig/)
- [Opção `strict`](https://www.typescriptlang.org/tsconfig/strict.html)
- [Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

## Consultar antes de

- definir `tsconfig` do frontend, backend ou código compartilhado;
- escolher resolução e formato de módulos;
- introduzir project references ou separar pacotes;
- usar recurso de linguagem dependente de versão;
- contornar um erro de tipos em integração externa.

## Regras específicas do projeto

- Habilite `strict` desde o scaffold e não introduza `any`.
- Use `unknown` e validação em limites como SDK, storage e rede.
- Tipos não substituem validação de dados recebidos em runtime.
- Evite assertions para esconder incerteza; faça narrowing ou adapte a fonte.
- `package.json`, lockfile e `tsconfig` serão a fonte da versão e das opções
  efetivamente adotadas.
