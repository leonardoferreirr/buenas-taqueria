# Imagens do ¡Buenas! — o que já tem e o que falta

Prompts com botão de copiar: https://claude.ai/artifact/2FHVfoeue97EM1nw6X6wNu
Salvar o original em `~/Downloads/restaurantes/01-buenas/` com o código como nome (`C4.png`, `L1.png`…).

## Já processado
| Código | Vira | Onde aparece |
|---|---|---|
| C0 | `cards/el-pastor-*` | baralho, abertura, leque do topo |
| C1 | `cards/la-birria-*`, `el-cazo-*`, `la-asada-*` | baralho |
| C2 | `cards/el-nopal-*`, `el-camaron-*`, `el-gallo-*` | baralho |
| C3 | `cards/la-sandia-*`, `la-luna-*`, `la-estrella-*` | baralho, La Luna, avaliações |
| H1 | `food/taco-pastor-*` | topo e anatomia |
| I1A–H | `food/ing-*` | órbita do topo, anatomia, versos, ardência |

## Falta (o site já está preparado: a imagem aparece sozinha ao ser processada)
| Código | Comando | Vira |
|---|---|---|
| C4 | `python3 tools/assets.py cards ~/Downloads/restaurantes/01-buenas/C4.png assets/img/cards el-diablito` | carta grande das salsas |
| C5 | `python3 tools/assets.py cards ~/Downloads/restaurantes/01-buenas/C5.png assets/img/cards la-mano` | carta grande da tortilla |
| L1 | `python3 tools/assets.py photo ~/Downloads/restaurantes/01-buenas/L1.png assets/img/photos storefront-hp` | fachada Highland Park |
| L1 (4:5 ou 2ª geração) | `... assets/img/photos storefront-bh` | fachada Boyle Heights |
| L3 | `python3 tools/assets.py photo ~/Downloads/restaurantes/01-buenas/L3.png assets/img/photos hands-masa` | La Mano |
| L5 | `python3 tools/assets.py photo ~/Downloads/restaurantes/01-buenas/L5.png assets/img/photos catering` | El Cazo |

Opcionais, que enriquecem mas não travam nada: **D1–D3** (pratos reais no verso das cartas, hoje os versos mostram os ingredientes), **L2** (taquero à noite, para a La Luna), **L4** (mão com quesabirria, para as avaliações), **T1** (textura de parede rosa).
**I2 e I3 não são mais necessários**: a anatomia usa o taco do H1 com os ingredientes do I1.

## Regras do recorte
- `cards`: arte em fundo creme. O creme de fora sai por flood fill a partir das bordas (o creme de dentro, como olhos e brilhos, fica), come 1px para matar o halo e descontamina a borda.
- `cutout`: PNG que já veio transparente do ChatGPT. Só apara e exporta.
- `split`: uma folha transparente com vários itens lado a lado.
- `photo`: foto normal, sem alfa.
Os PNGs mestres ficam em `raw/processed/` (fora do git).
