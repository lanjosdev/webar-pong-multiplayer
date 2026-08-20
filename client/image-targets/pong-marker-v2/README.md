# Image Target `pong-marker-v2`

Target padrão confirmado pelo usuário em 2026-08-20 após teste físico apresentar
resultado qualitativamente muito melhor que o v1. A validação do gate completo
de tracking ainda depende de escala, orientação, perda, reaquisição e
estabilidade.

- Tipo: planar, proporção nativa 3:4 sem crop.
- Dimensões físicas experimentais: 150 x 200 mm (baseline), 195 x 260 mm
  (máxima) e 180 x 240 mm (fallback para impressoras que recortem a máxima).
- Impressão: folha A4, escala 100%, preferencialmente em papel fosco e montada
  sobre base rígida e plana.
- Fonte canônica: `source/pong-marker-v2.png`, 1086 x 1448 px.
- SHA-256 da fonte:
  `C1151766C96783F857E7CB63B1F093D7CC4E00225B0C9F2665069A9891678BC7`.
- PDFs de impressão:
  - `../../../output/pdf/pong-marker-v2-a4-150x200mm.pdf`;
  - `../../../output/pdf/pong-marker-v2-a4-195x260mm.pdf`;
  - `../../../output/pdf/pong-marker-v2-a4-180x240mm.pdf`.

Nos PDFs maximizados, confirme com régua a dimensão impressa. Rejeite a variante
195 x 260 mm se qualquer borda estiver cortada ou se a medida variar mais de
1 mm; use então o fallback 180 x 240 mm. O mesmo conjunto digital de target é
usado para isolar a influência do tamanho físico.

A arte foi criada com a ferramenta integrada de geração de imagens, usando o
logotipo fornecido pelo usuário como referência. O prompt pediu composição Pong
assimétrica, alto contraste, detalhes variados em toda a área, ausência de texto
e robustez após redução para 480 x 640. Uma segunda iteração substituiu padrões
repetitivos por contornos e formas únicas.

Uma análise heurística do asset de luminância encontrou arestas em 9,0% dos
pixels, detalhes nas 48 regiões de uma grade 6 x 8 e 27,6% das arestas na metade
central. Esses números servem apenas para comparar os assets; não substituem o
teste do tracker do 8th Wall em aparelhos reais.

Os arquivos públicos foram gerados com `@8thwall/image-target-cli@1.0.0`,
geometria `flat` e crop central padrão. Como a fonte já possui proporção 3:4, o
manifesto preserva toda a imagem (`left: 0`, `top: 0`, 1086 x 1448).

O resultado do v1 permanece documentado como referência histórica, mas seus
assets foram removidos do repositório e do build. Não edite isoladamente o PNG
de luminância ou o manifesto; regenere o conjunto completo ao alterar a fonte.
