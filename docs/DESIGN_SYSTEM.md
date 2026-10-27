# BoraFute — Design System

Identidade oficial aplicada na Etapa 004.2-V, em 27/10/2026. Marca do produto independente de qualquer grupo, inclusive 4ª Força. Nenhuma nova tela ou funcionalidade de negócio.

## Marca e linguagem

- Nome: **BoraFute**.
- Slogan: **Bora pro jogo!**
- Frase institucional: **Seu futebol. Sua turma. Tudo no mesmo lugar.**
- Tom brasileiro, esportivo, direto e acolhedor; mensagens de erro continuam úteis e sem detalhes internos.
- Dados textuais compartilhados em src/lib/brand.ts; nome, descrição, títulos, footer e manifesto PWA atualizados. “Em campo” continua válido como expressão esportiva, não como nome do produto.
- Símbolo vetorial de bola, construído localmente, acompanha o nome. PNGs de instalação derivados do SVG, com variante maskable em fundo cheio e conteúdo central na área segura. Sem imagens de jogadores, marcas de grupos ou assets externos.

## Tokens e temas

Fonte de verdade dos tokens visuais: src/app/globals.css, com integração @theme inline do Tailwind. O tema acompanha prefers-color-scheme; color-scheme também informa os controles nativos. Não há toggle, persistência de preferência ou JavaScript adicional para tema.

| Token                      | Claro             | Escuro            | Uso                                       |
| -------------------------- | ----------------- | ----------------- | ----------------------------------------- |
| brand                      | #B8FF28           | #B8FF28           | Ações principais e assinatura             |
| brand-foreground           | #20252B           | #20252B           | Texto sobre verde elétrico                |
| brand-hover / brand-active | #A4EB14 / #94D509 | Iguais            | Interação da ação principal               |
| background                 | #F6F8F5           | #15191D           | Fundo da aplicação                        |
| foreground                 | #20252B           | #F3F6EF           | Texto principal                           |
| card / popover             | #FFFFFF           | #20252B           | Superfícies elevadas                      |
| primary                    | #356600           | #B8FF28           | Links e ênfase textual, distinto de brand |
| primary-foreground         | #FFFFFF           | #20252B           | Texto sobre primary                       |
| secondary                  | #E9EFE5           | #303831           | Ações secundárias                         |
| muted                      | #EEF2EC           | #29312C           | Superfícies discretas                     |
| muted-foreground           | #59645C           | #B3BEB4           | Descrições, ajuda e placeholders          |
| accent / accent-foreground | #E5F3D4 / #2D5700 | #334527 / #D5F5B0 | Hover e indicadores/badges                |
| border                     | #D8E0D7           | #414C43           | Separações decorativas de cartões         |
| input                      | #798678           | #809080           | Limites identificáveis dos campos         |
| ring                       | #356600           | #B8FF28           | Foco visível                              |
| skeleton                   | #DCE4D6           | #3F4D38           | Carregamento                              |
| pitch / pitch-foreground   | #20252B / #FFFFFF | Iguais            | Bloco gráfico esportivo da home           |
| destructive / superfície   | #B42332 / #FFF1F2 | #FF9EA9 / #3B2027 | Erro, invalidez e ação destrutiva         |
| destructive-foreground     | #FFFFFF           | #20252B           | Texto de ação destrutiva                  |
| success / superfície       | #24623C / #EDF8EE | #98E2B1 / #183426 | Confirmação de operação                   |
| info / superfície          | #24576C / #EEF6FA | #A8D9FA / #1A2E3B | Informação                                |
| warning / superfície       | #725000 / #FFF7DB | #F7D775 / #372F1A | Atenção                                   |

Nunca usar #B8FF28 como texto sobre branco. Usar primary para links e brand para superfícies de ação com texto grafite. Não reutilizar a borda decorativa border como única identificação de input; controles usam input. Cores de status acompanham texto/role, sem depender só da cor.

## Tipografia, forma e movimento

- Corpo: Arial, Helvetica, sans-serif, fontes do sistema; sem download externo.
- Assinatura e headline esportiva: Arial Black, Arial, Helvetica, sans-serif, peso forte e espaçamento compacto. Aparência varia conforme disponibilidade da fonte, preservando fallbacks.
- Texto de input/select/textarea em 16 px, evitando zoom involuntário comum em formulários móveis. Hierarquia e títulos existentes preservados; cabeçalhos de autenticação harmonizados em 24 px.
- Raio base 14 px, com variantes 10/12/14/18 px. Cartões usam sombra discreta centralizada em surface-shadow. Grid, conteúdo, ordem e breakpoints existentes mantidos.
- Control-height 44 px; botão padrão/sm e campos têm pelo menos 44 px, botão lg 48 px. Variantes compactas xs/icon-sm/icon-xs continuam disponíveis e não são usadas nas telas atuais; reavaliar alvo de toque antes de introduzi-las em navegação móvel.
- Transições de controles: 150 ms. prefers-reduced-motion reduz animações/transições e interrompe o pulso do skeleton. Não há animação essencial à compreensão.

## Componentes e telas

- Brand, cabeçalho público e AppShell: bola, nome oficial, linha de assinatura verde e slogan; navegação e logout preservados. Header privado mostra a frase institucional, com quebra de texto em telas estreitas.
- Button: ação elétrica com hover/active próprios; outline com borda identificável; foco sólido e deslocado; estados disabled e aria-invalid mantidos. Sem mudança no submit/asChild.
- Input e campos nativos: form-control compartilhado, fundo explícito, tipografia móvel, borda/foco/erro. Labels e atributos de formulário preservados.
- Card: superfície e sombra por tema. Badge: acento legível; foco de links/badges interativos sólido. Alert: variantes informativa, sucesso, atenção e erro, sem truncar título de mensagem.
- Mensagens de formulário/autenticação e confirmações no dashboard/grupo: feedback-error/feedback-success, preservando role=alert/status e o texto de segurança existente.
- Skeleton/loading: tom próprio e respeito a movimento reduzido.
- Home, login, cadastro, confirmação, recuperação e redefinição atualizados. Dashboard, grupos e perfil recebem tokens/componentes compartilhados; nenhuma consulta, permissão ou ação de negócio foi reescrita.
- Metadata e ícones PWA: BoraFute, frase oficial, cores de barra por tema quando suportadas. Manifesto estático usa fundo claro e theme_color grafite; não implementa offline/cache privado.

## Contraste verificado

Testes calculam luminância sRGB e contraste WCAG a partir do CSS real: 21 pares de texto por tema com mínimo 4,5:1 e quatro pares de borda/foco por tema com mínimo 3:1. Um teste adicional confere a consistência do manifesto com a identidade/cores. São 51 verificações novas, sem depender de CSS duplicado no teste.

| Par                             | Claro   | Escuro  |
| ------------------------------- | ------- | ------- |
| Grafite / verde elétrico        | 12,77:1 | 12,77:1 |
| Link primary / card             | 6,88:1  | 12,77:1 |
| Texto secundário / card         | 6,17:1  | 8,04:1  |
| Erro / superfície de erro       | 5,92:1  | 7,54:1  |
| Sucesso / superfície de sucesso | 6,67:1  | 8,89:1  |
| Borda de input / card           | 3,82:1  | 4,57:1  |
| Foco / card                     | 6,88:1  | 12,77:1 |

Esses resultados certificam os pares sólidos especificados, não toda combinação arbitrária com opacidade/overlay, estados desabilitados ou uma auditoria WCAG integral. A borda de cartão e os traços do campo ilustrativo são decorativos; controles não dependem deles. Conferência visual e limites da rodada estão em STAGE0042V.md.
