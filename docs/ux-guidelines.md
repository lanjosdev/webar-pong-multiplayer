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
Durante a procura, um guia 3:4 semitransparente deixa o centro visível e a
instrução fica fora do marcador: aproximar a 0,75–1,0 m, centralizar, manter o
celular firme e, após adquirir, afastar-se lentamente para o lado azul.

O laboratório interno `?trackingLab=1` acrescenta controles compactos para
target, campo fixo de 1,0 x 0,5 m, distância, cenário e modo de tracking. Esses
controles ficam bloqueados enquanto a câmera está ativa para evitar ensaios com
configuração ambígua. Em `world-absolute`, a interface orienta um movimento
lento para frente e para trás durante a estimativa de escala. Quando uma
reaquisição excede os limites seguros, o campo não salta: a interface solicita
recalibração explícita.

Em `world-relative`, a interface distingue perda do marcador, validação,
reancoragem automática, alinhamento e tracking limitado. Uma divergência grande
confirmada oculta brevemente o campo durante a troca de âncora. O fallback
`Buscar nova calibração` apenas solicita três observações atuais; ele não aplica
uma pose armazenada e permanece exclusivo do laboratório.

No fluxo público, antes da primeira observação válida a interface orienta “Aponte
a câmera para o marcador” fora do guia 3:4 e não exibe uma ação indisponível.
Depois da aquisição,
enquanto o campo ainda não estiver seguro, a instrução muda para “Mantenha o
celular firme enquanto o campo estabiliza”. Somente após a estabilização o
jogador é orientado por “Vá para o lado azul” e pode confirmar **Estou pronto**.
Uma retomada que invalide a pose volta à instrução de apontar para o marcador.
O topo mostra o placar azul/vermelho; o centro mostra contagem, autor do ponto,
pausa e fim da partida. Perder apenas o marcador mostra que o campo está mantido
pelo SLAM e não interrompe o jogo. Uma oscilação mundial inferior a 500 ms mostra
o sinal degradado sem pausar. Após uma pausa causada somente pelo SLAM, a UI
aguarda 750 ms estáveis e mostra “Retomando” por 1 s. Reancoragem e retorno do
background usam 750 ms estáveis e 3–2–1. Contagens já existentes são retomadas
ou reiniciadas, nunca empilhadas.

O parâmetro `?performanceProfile=minimal` existe somente para comparação A/B:
remove o preenchimento decorativo e blur sobre o feed e reduz a resolução do
canvas. Ele não altera mensagens, áreas de toque, regras ou geometria. O perfil
`standard` permanece padrão até a validação física.

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

- O protótipo usa arrasto relativo numa faixa transparente inferior com Pointer
  Events e `touch-action: none`.
- Um deslocamento horizontal igual à largura do viewport percorre toda a faixa
  válida da raquete. O controller limita posição e velocidade lógica.
- Novos inputs são ignorados durante contagem, ponto, pausa e fim da partida.
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
- Refinamento ergonômico da altura da faixa e sensibilidade do arrasto.
- Necessidade de onboarding ilustrado.
- Aprovação definitiva do comportamento de pausa e retomada em aparelho.
- Estratégia para dois jogadores e entrada em sala.
- Critérios de sucesso de usabilidade.
