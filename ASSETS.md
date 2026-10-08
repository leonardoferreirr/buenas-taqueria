# Imagens do ¡Buenas! — o que já tem e o que falta

Prompts com botão de copiar: https://claude.ai/artifact/2FHVfoeue97EM1nw6X6wNu
Originais em `~/Downloads/restaurantes/01-buenas/`, com o código como nome.

## Tudo processado (20 de 20 códigos gerados em 2026-10-08)

| Código | Vira | Onde aparece |
|---|---|---|
| C0–C3 | `cards/el-pastor-*`, `la-birria-*`, `el-cazo-*`, `la-asada-*`, `el-nopal-*`, `el-camaron-*`, `el-gallo-*`, `la-sandia-*`, `la-luna-*`, `la-estrella-*` | baralho, abertura, leque, La Luna, avaliações |
| C4 | `cards/el-diablito-*` | carta grande das salsas |
| C5 | `cards/la-mano-*` | carta grande da tortilla |
| H1 | `food/taco-pastor-*` | hero e anatomia |
| I1A–H | `food/ing-*` | órbita do hero, anatomia, versos |
| L1A (16:9) | `photos/storefront-hp-*` | El Mundo, Highland Park |
| L1B (4:5) | `photos/storefront-bh-*` | El Mundo, Boyle Heights |
| L4 | `photos/hands-masa-*` | La Mano |
| L5 | `photos/catering-*` | El Cazo |

**Atenção ao nome:** na geração, L3 e L4 trocaram de conteúdo. O `L4.png` é que
traz as mãos na prensa (o que o prompt L3 pedia) e virou `hands-masa`. O `L3.png`
ficou com a quesabirria no consomê, que era o conteúdo do prompt L4.

## Gerados e ainda não usados no site

`S1A–D` (as 4 salsas em tigela, vistas de cima), `D1A–D3C` (9 pratos reais para
os versos das cartas), `L2A/L2B` (taquero à noite, para a La Luna), `L3` (a
quesabirria, para as avaliações), `I2`/`I3`, `T1` (textura de parede).
Entram quando houver um lugar que ganhe com eles; nada no site depende deles.

## Regras do recorte

- `cards`: arte em fundo creme. O creme de fora sai por flood fill a partir das bordas (o creme de dentro, como olhos e brilhos, fica), come 1px para matar o halo e descontamina a borda.
- `cutout`: PNG que já veio transparente do ChatGPT. Só apara e exporta.
- `split`: uma folha transparente com vários itens lado a lado.
- `photo`: foto normal, sem alfa.
Os PNGs mestres ficam em `raw/processed/` (fora do git).

Depois de processar: `python3 tools/manifest.py` e `python3 tools/avif.py`.
O AVIF cobre `cards/`, `food/taco-pastor-*`, `food/ing-*` e `photos/`, e pesa cerca
de 45% menos que o WebP.
