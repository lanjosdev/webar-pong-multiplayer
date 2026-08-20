# WebAR Pong 3D Multiplayer

Experiência WebAR mobile de Pong 3D ancorada a um Image Target físico, acessada
diretamente pelo navegador. O projeto será entregue por gates: tracking WebAR,
jogo local e, somente depois, multiplayer autoritativo.

## Estado atual

O projeto está na fase de fundação. O cliente Vite + TypeScript já carrega a
distribuição própria do engine 8th Wall e possui um bootstrap de câmera com
`XrController`; Image Target, tracking validado e cena 3D ainda não foram
implementados. Consulte [PROJECT_PLAN.md](PROJECT_PLAN.md) para o progresso e os
critérios de saída de cada etapa.

## Desenvolvimento do cliente

Pré-requisitos: Node.js 24.19.0 e npm 11.6.0.

```bash
npm --prefix client ci
npm --prefix client run dev
```

O comando de desenvolvimento sincroniza automaticamente os artefatos originais
do XR Engine em `client/public/external/xr/`. Para validar o build em um celular
por HTTPS:

```bash
npm --prefix client run build
npm --prefix client run preview -- --port 4173 --strictPort
ngrok http --host-header=rewrite 4173
```

Abra a URL HTTPS fornecida pelo ngrok. Não versione tokens, configuração do
ngrok nem a cópia gerada do engine.

Validação completa:

```bash
npm --prefix client run check
```

O frontend possui package e lockfile próprios em `client/`. O backend futuro
será criado em `server/` com package independente; a raiz não é um workspace
npm.

## Documentação

- [Briefing do produto](docs/product-brief.md)
- [Arquitetura](docs/architecture.md)
- [Runtime WebAR](docs/webar-runtime.md)
- [Diretrizes de UX/UI](docs/ux-guidelines.md)
- [Padrões de engenharia](docs/engineering-standards.md)
- [Estratégia de testes](docs/testing.md)
- [Protocolo multiplayer futuro](docs/realtime-protocol.md)
- [Catálogo de referências oficiais](docs/references/README.md)
- [Registros de decisões arquiteturais](docs/adr/README.md)

## Sequência obrigatória

1. WebAR/Image Tracking validado em aparelhos reais.
2. Pong 3D local validado visualmente e tecnicamente.
3. Multiplayer para dois celulares.

Decisões pendentes são registradas como `TBD`; não devem ser inferidas como
requisitos confirmados.
