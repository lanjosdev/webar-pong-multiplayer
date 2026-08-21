# Diretrizes iniciais de UX/UI

Status: princípios confirmados pelo contexto do produto; bootstrap de câmera
implementado; identidade visual e fluxos posteriores permanecem TBD.

## Princípios

- Mobile-first e touch-first.
- A câmera e o ambiente físico fazem parte da interface.
- O usuário deve entender por que a câmera é necessária antes do prompt do
  sistema operacional.
- Cada espera ou falha precisa de estado visível e ação de recuperação.
- Instruções devem ser curtas, contextuais e legíveis sobre imagem variável.
- Controles não devem competir com a visualização do target e do campo.

## Jornada mínima da fase WebAR

1. Apresentar propósito e requisito de câmera.
2. Solicitar permissão em resposta a uma ação clara do usuário, quando exigido.
3. Ensinar como enquadrar o Image Target.
4. Dar feedback imediato quando o target for reconhecido.
5. Orientar recuperação quando o target for perdido.
6. Oferecer ação compreensível diante de incompatibilidade ou erro.

O fluxo implementado inclui carregamento, explicação antes do prompt, ação
explícita, câmera na maior área possível sem cortar seu campo de visão,
orientação para enquadrar, confirmação de detecção, instrução de reaquisição,
retry e encerramento. O layout aceita portrait e landscape, respeita safe areas
sem bloquear rotação. Quando as proporções divergem, o feed funcional permanece
inteiro e centralizado. O preenchimento decorativo permanece pausado enquanto o
target é procurado e só aparece, escurecido e sem blur, depois da aquisição.

O laboratório interno `?trackingLab=1` acrescenta controles compactos para
target, campo fixo de 1,0 x 0,5 m, distância, cenário e modo de tracking. Esses
controles ficam bloqueados enquanto a câmera está ativa para evitar ensaios com
configuração ambígua. Em `world-absolute`, a interface orienta um movimento
lento para frente e para trás durante a estimativa de escala. Quando uma
reaquisição excede os limites seguros, o campo não salta: a interface solicita
recalibração explícita.

Em `world-relative`, o laboratório distingue perda do marcador, validação,
reancoragem automática, alinhamento e tracking limitado. Uma divergência grande
confirmada oculta brevemente o campo durante a troca de âncora. O fallback
`Buscar nova calibração` apenas solicita três observações atuais; ele não aplica
uma pose armazenada. Esse comportamento não altera a política do fluxo público
nem a recalibração explícita de `world-absolute`.

## Estados obrigatórios de interface

- Carregamento inicial.
- Explicação de câmera e permissão.
- Permissão negada.
- Browser/aparelho incompatível.
- Procurando o target.
- Target encontrado.
- Target perdido e recuperação.
- Erro recuperável e erro fatal.
- Jogo pronto, em andamento, ponto, finalizado e reinício na fase 2.
- Conectando, aguardando jogador, desconectado e reconectando na fase 3.

## Controles touch

- Modelo de controle ainda é TBD e deve ser prototipado em aparelho.
- Áreas interativas devem ser grandes o suficiente e não depender apenas de
  precisão fina.
- Considere mão dominante, alcance do polegar, safe areas e interferência com
  gestos do navegador.
- Feedback visual deve acompanhar input sem aguardar confirmação de rede; a
  política multiplayer será definida posteriormente.

## Acessibilidade e legibilidade

- Manter contraste legível contra fundos de câmera claros e escuros.
- Não depender somente de cor para estado ou erro.
- Fornecer rótulos acessíveis para controles HTML.
- Respeitar preferências de redução de movimento na UI quando aplicável, sem
  comprometer o feedback essencial do jogo.
- Mensagens devem explicar a próxima ação, não apenas o problema.

## Decisões pendentes

- Estilo visual, tipografia, cores e áudio.
- Layout e gesto de cada raquete.
- Necessidade de onboarding ilustrado.
- Refinamento do comportamento visual quando o target é perdido; ocultar o
  conteúdo após 300 ms permanece a política do fluxo público; a retenção por
  SLAM existe somente no laboratório até aprovação do gate experimental.
- Estratégia para dois jogadores e entrada em sala.
- Critérios de sucesso de usabilidade.
