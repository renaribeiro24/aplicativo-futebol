# BoraFute — marca oficial, Etapa 004.2-V.1

Referência: imagem conceitual enviada pelo responsável em 27/10/2026, com B em movimento, bola integrada, lettering inclinado e assinatura em verde/branco. Implementação vetorial limpa orientada por essa referência; a imagem rasterizada não é usada no aplicativo. Substitui o símbolo anterior de bola isolada. A identidade de grupos, inclusive 4ª Força, permanece independente.

## Assinatura

Textos institucionais centralizados em src/lib/brand.ts:

- **BoraFute**.
- **Bora pro jogo!**
- **Seu futebol. Sua turma. Tudo no mesmo lugar.**

B inclinado e recortado com bola em seu espaço interno; trilhas horizontais com terminações arredondadas sugerem velocidade. Versão principal para fundo escuro: “Bora” branco, “Fute” e símbolo #B8FF28. Fundo da aplicação #15191D e superfícies grafite #20252B, mantendo níveis distintos. Branco #FFFFFF. Nenhum gradiente, brilho ou textura é necessário para reconhecer a marca.

Para fundo claro, “Bora” é grafite e “Fute”/símbolo usam o verde escuro #356600 do Design System para legibilidade. O verde elétrico continua nas ações e na assinatura sobre grafite. Não colocar o logotipo branco/verde elétrico diretamente sobre branco. Monocromáticas branca e grafite mantêm bola e recortes em uma tinta, com fundo transparente.

## Arquivos oficiais

Todos os SVGs têm lettering em contornos e não dependem de fontes ou imagens externas.

| Uso                               | Arquivos em public/brand                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| Principal: símbolo, nome e slogan | borafute-main-dark.svg / borafute-main-light.svg                 |
| Horizontal: navegação sem slogan  | borafute-horizontal-dark.svg / borafute-horizontal-light.svg     |
| Principal monocromática           | borafute-main-white.svg / borafute-main-graphite.svg             |
| Horizontal monocromática          | borafute-horizontal-white.svg / borafute-horizontal-graphite.svg |
| Símbolo B com bola, sem texto     | borafute-symbol.svg                                              |

Ícone/favicon: public/icons/icon.svg, B com bola sobre grafite. PNGs derivados: icon-192.png, icon-512.png, apple-touch-icon.png (180) e maskable-512.png (512, fundo cheio). O símbolo principal fica na região central segura do maskable; não contém palavra ou slogan. Manifesto/metadata preservam os caminhos existentes para evitar duplicação. Não se afirma instalação/atualização PWA em dispositivo real a partir de um simples teste de PNG.

## Uso no aplicativo

Brand é o único componente de marca: horizontal por padrão, principal quando há espaço, versões dark/light/white/graphite ou automática por preferência de tema. Picture seleciona a variante automática sem JavaScript; links têm um nome acessível e imagem decorativa, evitando anúncio duplicado. Assinaturas independentes têm alt com o nome e texto legível do slogan.

Na web, a variante principal compõe o SVG horizontal com **slogan HTML de 12 px**, centralizado pelo mesmo dado de brand.ts. Isso evita reduzir o slogan a 6–8 px em cartões móveis. O SVG principal com assinatura integral permanece disponível para reprodução grande/exportação. Não esticar ou editar os contornos isoladamente.

- Cabeçalho público e lateral: assinatura horizontal sobre grafite, sem slogan embutido em miniatura; a lateral pode apresentar o slogan como texto.
- Home: principal no painel esportivo grafite.
- Login/cadastro: principal em bloco de marca grafite, com formulários e validações preservados.
- Temas claro/escuro: conteúdo mantém os tokens já aprovados; áreas de marca priorizam grafite nos dois temas pela classe brand-surface. Não foi imposto modo escuro global nem preto absoluto em todas as superfícies.
- Símbolo para app e favicon; caminhos do manifesto preservados, conteúdo dos assets atualizado.

Preservar proporção, área livre e contraste. Usar horizontal em navegação compacta e principal em áreas maiores. O tamanho mínimo do símbolo deve ser revisto visualmente conforme densidade/tela; a inspeção digital desta rodada não equivale a teste de impressão ou touch/Safari real.

## Fonte dos desenhos e regeneração

scripts/generate-brand-assets.py concentra o desenho B/bola e gera as nove variações e o SVG do ícone. Lê nome/slogan de brand.ts e converte glyphs DejaVu Sans Bold Oblique em caminhos. A licença Bitstream/DejaVu está em public/brand/LICENSE-DejaVu.txt. A tipografia é usada como base de lettering esportivo; nenhum arquivo de fonte é carregado pelo produto.

Ferramentas de design já presentes no executor: Python fontTools e DejaVu Sans Bold Oblique. Não são dependências de execução nem pacotes adicionados ao aplicativo. Em ambiente de design equipado:

```sh
python3 scripts/generate-brand-assets.py
node scripts/generate-brand-icons.mjs
```

O segundo script utiliza sharp, já presente na árvore do Next, para derivar PNGs a partir do SVG. Não lê a imagem de referência nem configurações de ambiente/credenciais. Os exports compartilham a mesma fonte do desenho; não manter cópias manuais divergentes. Alterar o desenho exige revisão da marca, regeneração e conferência de tamanhos/temas.

## Verificação e limitações

Resultados finais em STAGE0042V1.md. Os testes de contraste do Design System continuam válidos para os pares especificados, sem certificar todas as aplicações possíveis da marca. Texto de marca convertido em contornos continua com alternativa acessível. Confirmação visual autenticada das áreas privadas e homologação Supabase 004.2-H permanecem independentes e pendentes.

![Variações oficiais do BoraFute](assets/borafute-brand-v1.png)
