# Catálogo de referências oficiais

Última verificação: 2026-08-19.

Este diretório orienta a consulta de documentação externa. Ele não substitui a
documentação oficial nem fixa versões que ainda não foram instaladas.

## Regra de uso

1. Confirme a tecnologia e a versão em `package.json`, lockfile e arquivos de
   configuração. Esses arquivos serão a fonte de verdade quando existirem.
2. Leia somente a referência relacionada à tarefa.
3. Consulte a documentação oficial compatível com a versão instalada antes de
   usar APIs, opções de configuração ou comportamento de runtime.
4. Não copie grandes trechos de documentação para o repositório. Registre aqui
   apenas rotas de consulta, restrições do projeto e conclusões duráveis.
5. Se a consulta mudar uma decisão arquitetural, atualize o documento afetado e
   crie um ADR quando a decisão tiver impacto amplo ou for difícil de reverter.

## Índice

| Tecnologia | Uso no projeto | Momento | Referência |
| --- | --- | --- | --- |
| 8th Wall | WebAR e Image Targets | Fases 0 e 1 | [8th Wall](8th-wall.md) |
| Three.js | Cena e renderização 3D | Fases 1 e 2 | [Three.js](threejs.md) |
| Vite | Ambiente e build do frontend | Fase 0 em diante | [Vite](vite.md) |
| TypeScript | Linguagem do frontend e backend | Todas | [TypeScript](typescript.md) |
| Web Platform | Câmera, lifecycle, input e WebGL | Fases 0 a 2 | [Web Platform](web-platform.md) |
| Socket.IO | Opção de transporte realtime | Adiado até a fase 3 | [Socket.IO](socketio.md) |
| Node.js | Runtime futuro do servidor | Adiado até a fase 3 | [Node.js](nodejs.md) |

## Critério de atualização

- Atualize a data de verificação do arquivo quando os links e as conclusões
  tiverem sido revisados nas fontes oficiais.
- Não altere uma URL apenas porque existe documentação de uma versão mais nova;
  primeiro confirme a versão usada pelo projeto.
- Conteúdo legado pode ser consultado para migração, mas deve ser identificado
  como legado e não tratado como orientação atual.
