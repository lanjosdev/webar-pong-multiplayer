# Padrões de engenharia

## Objetivo

Manter o projeto modular, verificável e fácil de evoluir, sem adicionar
abstração ou infraestrutura antes de existir uma necessidade demonstrada.

## Design de módulos

- Cada módulo deve ter uma responsabilidade predominante e uma API pequena.
- Dependências devem ser explícitas e apontar para contratos estáveis.
- Efeitos externos ficam nas bordas; regras de domínio permanecem testáveis sem
  browser, câmera, rede ou renderer.
- Evite ciclos de dependência, singletons mutáveis e registries globais.
- Prefira composição. Use classes quando lifecycle, identidade ou encapsulamento
  de estado justificarem seu uso.
- Não crie camadas que apenas repassam chamadas sem proteger uma fronteira.

## TypeScript

- Habilitar modo estrito no scaffold.
- Não usar `any`; converter dados desconhecidos após validação.
- Modelar estados finitos com uniões discriminadas quando isso impedir estados
  inválidos.
- Não duplicar tipos de protocolo entre cliente e servidor.
- Tipos não substituem validação runtime para câmera, storage, URL ou rede.
- Evitar type assertions sem invariantes documentados.

## Estado e efeitos

- Definir uma fonte de verdade por conceito.
- Separar atualização do estado lógico de sua representação Three.js ou DOM.
- Tornar inicialização, pause/resume e teardown idempotentes quando possível.
- Remover listeners, timers, animation frames e conexões no teardown.
- Erros devem preservar contexto útil sem expor segredos.

## Desempenho mobile

- Não alocar objetos por frame sem necessidade medida.
- Reutilizar vetores e estruturas temporárias em loops quentes quando isso for
  relevante e legível.
- Carregar e preparar assets fora do render loop.
- Controlar resolução, draw calls, materiais e tamanho de assets com medições.
- Registrar aparelho e cenário junto às métricas; números sem ambiente não são
  comparáveis.

## Segurança

- Nunca versionar credenciais, tokens ou chaves do 8th Wall.
- Separar variáveis públicas do Vite de segredos server-side.
- Validar toda entrada externa nos limites do sistema.
- No multiplayer, validar identidade, sala, payload, frequência e transições de
  estado no servidor.
- Não confiar no cliente para placar, colisão ou resultado competitivo.

## Testabilidade

- Injetar relógio e aleatoriedade quando regras determinísticas dependerem
  deles.
- Testar game core sem Three.js ou 8th Wall.
- Testar adapters com fakes nas bordas; não fingir que isso substitui aparelhos
  reais para tracking.
- Bugs reproduzíveis devem ganhar teste de regressão quando automatizáveis.
- Testes devem verificar comportamento, não detalhes internos frágeis.

## Mudanças e revisão

- Mudanças devem ser pequenas o suficiente para revisão, mas completas em
  comportamento e documentação.
- Explicar trade-offs de novas dependências e decisões arquiteturais.
- Atualizar documentação e plano na mesma alteração relevante.
- Não marcar trabalho como validado quando a checagem necessária não pôde ser
  executada.

