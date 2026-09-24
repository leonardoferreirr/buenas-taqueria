# ¡Buenas! Taquería

Site de portfólio, marca fictícia. Site 01 da Série Restaurantes EUA: taquería em Highland Park e Boyle Heights, Los Angeles. A ideia que organiza tudo: **o cardápio é um baralho de lotería**, onde cada prato é uma carta ilustrada que vira e mostra o prato com preço.

Conceito, copy e manifesto de imagens: `05_WORKSPACE/projetos/restaurantes-eua/01-buenas/conceito.md` no Drive do Kit Piloto Automático.
Brand board com os prompts: https://claude.ai/artifact/2FHVfoeue97EM1nw6X6wNu

## Como mexer

O arquivo publicado é o `index.html` da raiz, e ele é **gerado**. Nunca edite ele à mão.

```bash
python3 tools/build.py          # _src/index.html + assets -> index.html
python3 tools/build.py --check  # avisa se o gerado está velho
```

| Onde | O quê |
|---|---|
| `_src/index.html` | estrutura e textos (fonte da verdade) |
| `assets/css/main.css` | sistema visual e todas as seções |
| `assets/css/modules/` | CSS de cada peça animada |
| `assets/js/main.js` | núcleo: rolagem, cabeçalho, pedido, faixas, horário |
| `assets/js/modules/` | abertura, baralho, anatomia, salsas, tabla |
| `assets/js/dist/` | gerado pelo build, não editar |

O build junta e minifica o CSS (embutido na página, para pintar na primeira resposta), gera o núcleo de JS num arquivo com `defer` e deixa os 4 módulos pesados para carregar só quando a seção se aproxima. Também troca as imagens por `<picture>` com AVIF onde existir.

## Servidor local

```bash
python3 tools/serve.py
```
Abre em http://127.0.0.1:8751 (comprime como a Vercel, para a medição local não mentir).

## Imagens

Ver `ASSETS.md`: o que já está processado, o que falta e o comando de cada uma.
Os encaixes vazios do site preenchem sozinhos assim que o arquivo aparece, porque o site consulta `assets/img/manifest.json`.

```bash
python3 tools/assets.py cards|cutout|split|photo <origem> <destino> <nome...>
python3 tools/manifest.py   # depois de mexer em assets/img/
python3 tools/avif.py       # gera os AVIF ao lado dos WebP
python3 tools/subset.py     # recorta as fontes para os caracteres usados
```

## Conferir antes de publicar

```bash
python3 tools/audit.py both     # rola a página inteira, console, overflow, capturas
python3 tools/sheet.py desktop  # folha de contato das capturas
python3 tools/interact.py       # testa pedido, carta, salsa, jogo, formulário
python3 tools/interact.py --mobile
./tools/lh.sh 3                 # Lighthouse 3x, mediana
```

O gate: Lighthouse mobile ≥95 com throttle real, console limpo, sem rolagem horizontal, nada nascendo invisível, e conferência no celular.

## Decisões que valem lembrar

- **O JS do núcleo é um arquivo com `defer`, não embutido.** Script embutido roda antes de qualquer `defer`, então o núcleo decidia que não havia GSAP e o site ficava parado.
- **Nada anima o eixo de largura da fonte no carregamento.** Num texto do tamanho da tela isso reflui a linha inteira a cada quadro: come a nota e faz a página pular. O grito da abertura é `transform`; a largura variável só entra no scroll, que é movimento pedido pela pessoa.
- **A reserva da fonte de título tem duas medidas** (`--display` e `--display-narrow`), porque a mesma fonte aparece de wdth 62 a 78 e ocupa espaços bem diferentes. Com uma só, o título quebrava em 3 linhas antes da fonte e em 1 depois.
- **O nome gigante só aparece com a fonte pronta** (`fonts-pending`), e fica fora do dimensionamento do palco para não empurrar o taco.
- **Enfeite não roda no carregamento nem fora da tela**, e o desenho decorativo vai em pedaços no tempo ocioso.
- `noindex` e aviso de projeto conceitual no rodapé: é marca fictícia com cidade real.
