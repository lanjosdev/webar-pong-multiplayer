# Diretrizes iniciais de UX/UI

Status: princípios confirmados pelo contexto do produto; identidade visual e
fluxos detalhados permanecem TBD.

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

- Portrait ou landscape.
- Estilo visual, tipografia, cores e áudio.
- Layout e gesto de cada raquete.
- Necessidade de onboarding ilustrado.
- Comportamento visual quando o target é perdido.
- Estratégia para dois jogadores e entrada em sala.
- Critérios de sucesso de usabilidade.

