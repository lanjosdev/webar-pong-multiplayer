# Referência oficial — Three.js

Última verificação: 2026-08-19. Versão do projeto: **TBD**.

## Fontes oficiais

- [Documentação](https://threejs.org/docs/)
- [Object3D e hierarquia de transforms](https://threejs.org/docs/pages/Object3D.html)
- [Matrix4](https://threejs.org/docs/pages/Matrix4.html)
- [Quaternion](https://threejs.org/docs/pages/Quaternion.html)
- [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
- [Descarte de recursos](https://threejs.org/manual/en/how-to-dispose-of-objects.html)

## Consultar antes de

- converter a pose do Image Target em transform da raiz AR;
- alterar hierarquia, escala, orientação ou matrizes da cena;
- configurar renderer, pixel ratio, sombras, transparência ou color management;
- carregar texturas/modelos ou criar recursos com lifecycle próprio;
- implementar teardown, recuperação de contexto WebGL ou otimizações gráficas.

## Regras específicas do projeto

- Confirme a versão instalada antes de seguir exemplos; APIs mudam entre
  releases.
- Three.js representa e renderiza a cena, mas não é a fonte do estado lógico do
  jogo.
- A pose do tracking move uma raiz AR dedicada; entidades do jogo permanecem em
  coordenadas locais previsíveis.
- Evite alocação de vetores, matrizes, materiais e geometrias por frame.
- Faça `dispose()` explícito de recursos GPU que deixam de ser usados.
- Use imports por módulo e não acrescente addons sem necessidade documentada.
