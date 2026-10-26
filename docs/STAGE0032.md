# Etapa 003.2 — auditoria de segurança e estabilização

Estado em 26/10/2026: **etapa ainda aberta para homologação manual complementar**. Matriz privada automatizada PASS nas quatro combinações, 46/46 checks; evidências JWT/SSR anteriores preservadas.

## Matriz privada automatizada aprovada — 26/10/2026

Captura do proprietário confirma execução no Codespaces com executor 475da8d: **PASS, authenticated_owner_readonly, diagnosticOnly=false, 46 verificações aprovadas, zero reprovadas, failedChecks vazio**. As quatro combinações passaram: desktop 1440×900 claro/escuro e celular (viewport) 390×844 claro/escuro.

Relatório informado: work/stage0032-ui-0b8dce63-aa96-4a99-bacf-d8f40d525405/report.json. Fonte: saída sanitizada apresentada pelo proprietário; o arquivo privado não foi lido neste executor. Não houve novo teste autenticado neste workspace.

| Combinação     | Automação privada somente leitura |
| -------------- | --------------------------------- |
| Desktop claro  | PASS                              |
| Desktop escuro | PASS                              |
| Celular claro  | PASS                              |
| Celular escuro | PASS                              |

O resultado comprova os checks do executor: layouts de login nas quatro combinações, login/sessão, dashboard, grupo próprio e formulário de convidado visível, perfil, formulário de novo grupo, grupo alheio not-found sem os marcadores de texto privados verificados, página inexistente, labels/foco básico, ausência de overflow e de erros inesperados nas páginas auditadas, navegação dashboard→grupo→perfil, logout e bloqueio anônimo das rotas privadas. Logout foi executado uma vez ao final, não quatro vezes. O código não cadastrou convidados/grupos, não salvou perfil e não guardou sessões/capturas privadas.

A falha de rede anterior continua registrada como observação não reproduzida: o diagnóstico restrito passou 7/7 e esta matriz completa passou 46/46, mas isso não determina retrospectivamente a causa daquela requisição. Não repetir a matriz, SSR ou testes de C sem alteração/falha nova que justifique.

**O que resta:** testes manuais complementares do checklist (não repetir a navegação já comprovada): submissão de convidado em grupo UI separado; edição de perfil técnico; mensagens de sucesso/validação; contraste/foco/teclado completo e zoom; estados de loading/vazio quando elegíveis; controles visuais da conta C e direção visual B→A prevista no roteiro. Registrar evidências/justificativas de NÃO APLICÁVEL. A automação atual não prova esses itens por não submeter formulários nem usar B/C na matriz visual.

Etapa 003.2 continua aberta somente para as verificações/evidências obrigatórias remanescentes e decisões já discriminadas; matriz privada automatizada não está mais bloqueada. Aceite de risco de desenvolvimento e limites administrativos anteriores preservados. Nenhuma permissão, RLS, domínio, produção ou fixture foi alterada nesta atualização documental.

## Diagnóstico de rede no dashboard — 26/10/2026

Nova captura do proprietário, após atualizar para 606c3e4: execução privada FAIL no desktop_light_/dashboard, cinco checks aprovados e um reprovado; demais combinações PENDENTE. O resumo sanitizado do relatório mostra HTTP 200, sem overflow, h1=1, main=true, nenhum campo sem label, keyboard=true, console=0, page=0, http=0, **network=1** e **canceledPrefetches=5**. Portanto, o único critério reprovado é uma falha de rede ainda não identificada. Não atribuir automaticamente essa sexta requisição a prefetch, sessão, RLS ou defeito do produto.

Observabilidade ampliada sem afrouxar aprovação: networkFailures agora contém apenas códigos Chromium conhecidos, tipo/método por allowlist, categoria app_route/app_api/static_asset/external/unknown, flag prefetch, navegação e indicação de início na etapa anterior. URL, host externo, query, credenciais, cookies, headers e corpo nunca são gravados. Outros valores viram other. O detalhe das asserções reprovadas também passa a aparecer na saída sanitizada, sem precisar imprimir relatório bruto. Erros de rede desconhecidos continuam bloqueantes.

Modo **--authenticated --dashboard-only** adicionado para uma única passagem dirigida: mantém as quatro verificações de layout do login para reproduzir a preparação anterior, faz um login real e testa somente a página privada dashboard em desktop claro. Não visita grupo, perfil ou as demais combinações privadas; se chegar ao final, faz logout e confere /api/me 401. Saída rotulada authenticated_dashboard_diagnostic e diagnosticOnly=true. Um eventual PASS desse modo não aprova toda a matriz nem prova a causa da falha intermitente anterior.

```sh
NODE_PATH="$PWD/work/ui-tools/node_modules${NODE_PATH:+:$NODE_PATH}" \
node --env-file=work/stage0032.test.env \
  scripts/test-stage0032-ui.mjs --authenticated --dashboard-only
```

Executar uma vez no Codespaces depois de atualizar develop. Compartilhar apenas a saída sanitizada, especialmente failedChecks/networkFailures. Não repetir a matriz completa nem ignorar requisições com base só no status 200 ou no nome ERR_ABORTED. Se não reproduzir, registrar essa limitação; se reproduzir, usar categoria/tipo/lifecycle para identificar a fronteira antes de corrigir.

Testes locais: formatação, lint, typecheck, **126 testes em 15 arquivos** e build passaram. Novos testes verificam categorias de recursos, metadados de lifecycle e supressão de URL/query/credenciais/mensagens arbitrárias. Nenhum teste autenticado foi repetido neste executor e nenhuma causa histórica específica foi inventada. Sem alteração de aplicação, RLS, permissões, alias ou dados. Etapa continua aberta.

## Correção do seletor do formulário de convidado — 26/10/2026

O proprietário apresentou a primeira execução privada do executor: FAIL, desktop/light, checkpoint desktop_light_/groups/[own], seis verificações aprovadas e uma reprovada; demais combinações PENDENTE. Relatório informado: work/stage0032-ui-6462eac3-d472-468c-985d-27c3ad45f048/report.json. A fonte desta evidência é a captura do terminal; o arquivo privado não foi lido neste executor.

**Defeito confirmado no executor:** o teste de presença do formulário usava #name. TextField renderiza label envolvendo Input com name=name e texto Nome do jogador, sem atribuir id=name. Logo, o seletor antigo retorna falso mesmo quando o formulário correto está renderizado. Corrigido para getByRole("textbox", {name:"Nome do jogador",exact:true}); nenhuma alteração de aplicação, layout, RLS ou autorização foi necessária. Caso a conta não possua administração, o seletor acessível continuará ausente e o teste deve falhar; a correção não contorna essa proteção.

Também corrigida a observabilidade: quando check(label,...) reprova, failure.checkpoint passa a registrar o label completo, inclusive o sufixo _guest_form, em vez de apenas a rota corrente. Nenhum texto privado ou detalhe de credencial foi acrescentado ao relatório.

Validação: componente TextField real renderizado por ReactDOM no teste de regressão, verificando associação implícita label/input obrigatório. Reprodução Chromium isolada, sem Auth: #name encontra zero; textbox com nome acessível é visível. Formatação, lint, typecheck, **123 testes em 15 arquivos** e build passaram. A reprodução isolada não é aprovação da interface privada.

**Não foi repetida a sessão autenticada nesta máquina**, que continua sem credenciais A. O resultado histórico FAIL não foi convertido em PASS. Próximo passo: atualizar develop no Codespaces preservando arquivos locais e executar uma vez o executor UI corrigido, usando Playwright isolado em work/ui-tools e as credenciais existentes. Não repetir JWT C ou suíte integral A/B; não mudar permissões para tornar um formulário visível.

Gravidade: baixa, falso negativo/seleção no executor, corrigido. A homologação privada permanece aberta até a nova execução e os itens manuais obrigatórios do checklist. Relatório anterior e fixtures devem ser preservados.

## Homologação de interfaces e relato de C — 26/10/2026

**Etapa ainda aberta: matriz privada não executada nesta sessão.** Roteiro completo em [STAGE0032-UI-CHECKLIST.md](STAGE0032-UI-CHECKLIST.md), com status PASS/FAIL/PENDENTE/NÃO APLICÁVEL, instruções, resultados esperados e campos de evidência para as quatro combinações.

### Evidência da conta C recebida

O proprietário informou PASS em 20/20 checkpoints JWT reais, sem falha de permissão, com proprietário original preservado e C player/active. Run 02b9bebb-47e0-400a-b03d-5c4035b10f2f; arquivo informado: work/stage0032-member-c-02b9bebb-47e0-400a-b03d-5c4035b10f2f.json.

**Proveniência:** resultado informado pelo proprietário; o arquivo não foi encontrado no workspace acessível, e o Codespaces não está anexado. Não se afirma leitura, hash ou revisão independente desse relatório. O checklist inclui comando somente leitura que emite contagens e flags de integridade, sem conteúdo privado, para confirmar o artefato no Codespaces. Não repetir a suíte C para obter esse resumo.

Assim, ficam consolidados: 117 testes unitários anteriores; SSR 6/6 já documentado por captura; C 20/20 conforme relato atual. Esses resultados não equivalem à homologação visual privada.

### Deployment e alias efetivamente verificados

Vercel get_alias/get_deployment confirmaram www.borafute.com.br → **dpl_Gf8Px4vi8NhfP8viPajE5TXBzHA2**, READY, target=null (Preview), branch develop, commit **2c0447dc9af4652c1e026d7185bbd64103b7a99f**. HEAD remoto antes desta tarefa: 18f53eff43ba72924ea8b8064539f24051f6b29e. O alias está fixo e não acompanha HEAD automaticamente. A comparação GitHub não encontrou alterações em src/ entre esses commits, mas encontrou mudanças em ferramentas, lockfile e documentação. Não certificar todo o deployment mais recente ou equivalência de configuração por essa comparação. Não houve atualização de alias, domínio, DNS ou deploy de produção.

Consultas HTTPS por integração Vercel (sem sessão do aplicativo):

| Rota                  | Evidência                                                                           |
| --------------------- | ----------------------------------------------------------------------------------- |
| /login                | HTTP 200; formulário real; private/no-store                                         |
| /dashboard            | Ferramenta seguiu redirect: HTTP 200 final, x-matched-path=/login, private/no-store |
| /groups/[sintético A] | HTTP 200 final em /login, private/no-store                                          |
| /profile              | HTTP 200 final em /login, private/no-store                                          |
| /api/me               | HTTP 401                                                                            |

Os HTTP 200 finais não são o status original do redirect. Nenhum DEPLOYMENT_NOT_FOUND nas páginas retornadas. O curl direto do executor recebeu CONNECT 403/HTTP 000: limitação de proxy, não falha HTTP da aplicação. Não houve tentativa de contorno. As consultas pela integração não equivalem a teste de navegação Playwright no domínio.

### Ferramentas e automação executada

Playwright e Chromium já estavam disponíveis no executor. **Nenhuma dependência ou browser foi instalado.** O script novo scripts/test-stage0032-ui.mjs oferece --check, --local-public e --authenticated; o modo privado faz um único login de A para as quatro combinações e não persiste sessão, HAR ou traces, nem captura páginas privadas. Não submete criação de convidado/perfil/grupo; esses fluxos persistentes ficam no roteiro manual em fixtures UI separadas.

Nesta sessão, sem secrets/runtime variables, TEST_USER_A_EMAIL/PASSWORD não estavam disponíveis. --authenticated foi bloqueado antes de abrir uma sessão/login; zero checks privados aprovados ou reprovados, quatro combinações PENDENTE. O relatório bloqueado em work/ fica como registro de ambiente, não defeito do produto. --check apenas indica disponibilidade das ferramentas/credenciais, não validade de senha ou acesso de rede.

Automação local real sobre build de produção, sem configuração Supabase, em http://127.0.0.1:3300:

- **45 verificações PASS, zero FAIL**, incluindo 40 visitas a dez rotas em quatro combinações, API fechada 503 e quatro verificações explícitas do aviso de preparação no login.
- Rotas: home, login, cadastro, recuperação com mensagem context, confirmação, reset, dashboard, criar grupo, perfil e página inexistente. Rotas privadas mostram preparação: não há usuário/sessão fictícia.
- Viewports 1440×900 e 390×844, colorScheme light/dark. Zero overflow horizontal; um h1 e main presentes; inputs visíveis com labels; foco em elemento interativo após Tab.
- Zero erros JavaScript não tratados, erros de console não esperados ou falhas HTTP/rede inesperadas. Não é auditoria WCAG completa nem medição automatizada de contraste.
- Fundos calculados mudaram de oklch(0.975 0.004 250) no claro para oklch(0.18 0.018 255) no escuro em ambos os tamanhos. Capturas da home desktop clara e celular escura inspecionadas: layout legível, sem cortes/overflow. Skip link aparece por estar focado pelo teste de teclado.
- Relatório final: work/stage0032-ui-b1e3fec0-d67c-4fc7-9be6-2b74e3df84fa/report.json. Quatro imagens públicas desktop-light-public.png, desktop-dark-public.png, mobile-light-public.png e mobile-dark-public.png no mesmo diretório. Nenhum artefato privado ou credencial publicado no Git.

| Combinação     | Público/preparação local | Interface privada no Preview |
| -------------- | ------------------------ | ---------------------------- |
| Desktop claro  | PASS                     | PENDENTE                     |
| Desktop escuro | PASS                     | PENDENTE                     |
| Celular claro  | PASS                     | PENDENTE                     |
| Celular escuro | PASS                     | PENDENTE                     |

A primeira execução local parou por seis cancelamentos de prefetch classificados erroneamente como erro de rede; relatório inicial work/stage0032-ui-b226e991-730d-4a34-bbbc-ce1b0faa2c51/report.json preservado. Diagnóstico confirmou fetch especulativo next-router-prefetch com net::ERR_ABORTED. Corrigida exclusivamente a classificação no executor: ignorar apenas ERR_ABORTED e header next-router-prefetch=1, registrando contagem separada; qualquer outro erro continua bloqueante. Cinco testes unitários cobrem o falso positivo e falhas que não podem ser ignoradas. A validação de código final passou em formatação, lint, typecheck, 122 testes em 15 arquivos e build. A execução final acima passou após essa correção. Não foi alterada a aplicação para satisfazer os testes.

### Problemas, limites e roteiro de execução

| Achado                                                          | Classificação                         | Situação                                                |
| --------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| Prefetch cancelado contado como falha                           | Baixa, executor de testes             | Corrigido e coberto por regressão                       |
| Alias serve commit anterior ao HEAD                             | Média, rastreabilidade da homologação | Registrado; nenhuma associação alterada sem autorização |
| Credenciais/browsing privado e relatório C indisponíveis aqui   | Bloqueio de ambiente/evidência        | Não confundir com vulnerabilidade                       |
| Contraste completo, toque, loading, vazio e submissões privadas | Cobertura manual                      | PENDENTE conforme checklist                             |

Nenhum defeito visual do produto foi comprovado no escopo público executado; a interface privada ainda pode conter defeitos não observados.

No Codespaces ou executor autorizado com Playwright/Chromium já disponíveis, conferir novamente deployment/alias e usar:

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-ui.mjs --check
node --env-file=work/stage0032.test.env scripts/test-stage0032-ui.mjs --authenticated
```

Não usar conta pessoal; somente A técnica com acesso owner ao grupo sintético esperado. Se faltar navegador/ferramenta, usar o roteiro manual; não há instalação automática nem bypass de Vercel. Se faltar acesso ao domínio, não contornar o proxy. Guardar relatório sanitizado; capturas privadas manuais precisam de recorte/máscara. O executor navega em fixtures existentes, não modifica 4ª Força/Grupo Teste 2, não cria/exclui usuários e não limpa fixtures.

Para cadastro de convidado/sucesso/edição persistente, o proprietário deve usar grupo UI sintético separado, registrar novas fixtures e preservá-las. Validar layout e resultados nas quatro combinações; não multiplicar submissões desnecessárias. Lista de grupos fica no dashboard; não há rota /groups de listagem nem menu hambúrguer/aceite público de convite a inventar.

### Condições de encerramento

1. Conferir o resumo seguro do relatório C no ambiente onde o arquivo existe, sem refazer autenticação.
2. Executar e registrar navegação privada nas quatro combinações contra deployment identificado.
3. Completar os itens manuais obrigatórios: submissões e mensagens, contraste/foco/teclado, loading/vazio quando alcançáveis e ausência visual de dados de outro grupo. Justificar NÃO APLICÁVEL por recurso/estado realmente inexistente; não transformar bloqueio em PASS.
4. Revisar defeitos eventualmente encontrados e decisões de risco já documentadas, mantendo o aceite de desenvolvimento dentro de seu prazo/escopo.

Etapa não encerrada; sem liberação formal para Etapa 004 ou produção. Riscos e histórico abaixo preservados; nenhuma autorização de produção foi inferida.

## Permissões reais da conta C — preparação do executor (26/10/2026)

**Conta e vínculo confirmados por leitura administrativa; permissões JWT de C ainda não executadas neste executor.** A ausência de C registrada em 22/10 é histórica e não descreve o estado atual.

### Pré-condições reais verificadas, sem mutação

Supabase consultado somente por SELECT, sem simular identidade de C:

- auth.users confirma email_confirmed_at preenchido para C 111e7247-9007-41ce-a594-da1665e785e6; perfil existente.
- Vínculo 49f6781c-b0c7-4735-ba1c-e34fb8a6871f corresponde a C, grupo A 45792949-85ee-4149-9398-c3d0e894676e, role=player/status=active.
- Grupo A usa o slug sintético audit-0032-a-8467145b-fb16-4cbd-89f5-3cf149b3a830, possui exatamente três integrantes (owner/convidado/C) e seu owner ativo corresponde ao criador original.
- Grupo B sintético 8a332978-f572-4345-9073-f46a4ca7809d existe e também mantém um único owner ativo.
- Nenhuma inserção foi repetida. Não houve UPDATE/DELETE, alteração de RLS/grants, Auth, Vercel ou domínio.

O executor disponível continua separado do Codespaces e sem secrets/runtime variables configurados. TEST_USER_C_EMAIL, TEST_USER_C_PASSWORD e as variáveis públicas não estão disponíveis aqui. O novo --check foi executado e mostrou as cinco variáveis ausentes. **Leitura privilegiada dessas pré-condições não representa teste JWT ou prova de autorização de C.**

### Executor direcionado criado

scripts/test-stage0032-member-c.mjs usa apenas createClient do SDK com chave publicável, persistSession=false e sessão em memória de C. Não utiliza cliente administrativo, não cria vínculo e não executa exclusões. O UUID de getUser precisa corresponder exatamente a C e o e-mail deve estar confirmado; projeto e UUIDs de fixtures são fixados para impedir uso acidental em outro ambiente.

Pré-flight positivo com C: ler seu perfil, grupo A, três vínculos e respectivos players autorizados. O executor exige C player/active no vínculo conhecido e um owner original, sem identidades inesperadas nesse conjunto sintético. Em seguida:

| Cenário preparado                                      | Critério de aprovação                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Login normal e getUser C                               | Sessão real emitida pelo provedor, UUID exato, confirmação presente                         |
| Perfil próprio, grupo A, integrantes/players           | Leituras autorizadas e fixture esperada                                                     |
| Grupo B: groups/group_members/players de origem B      | Zero linhas para C, com o recurso sintético existente na pré-verificação administrativa     |
| Autoelevação direta e set_member_role para admin/owner | SQLSTATE 42501/HTTP 403 ou, só no DML direto, resposta 2xx com array vazio                  |
| Alterar papel de outro integrante                      | RPC set_member_role negada                                                                  |
| Desativar owner, diretamente e por RPC                 | Tentativa negada; nenhum DELETE é enviado                                                   |
| Transferir propriedade para C                          | RPC transfer_ownership negada                                                               |
| Alterar dados administrativos de A e B                 | UPDATE negado ou zero linhas afetadas                                                       |
| Cadastrar convidado em A e B                           | add_guest_once com argumentos válidos negada                                                |
| Criar convite em A e B                                 | create_invitation com argumentos válidos negada                                             |
| Integridade após cada tentativa                        | Snapshot de perfil/grupo A/membros/players idêntico; C player/active e owner original único |

São 20 checkpoints esperados (incluindo 14 tentativas negativas e a conferência final), executados sequencialmente e interrompidos na primeira falha. HTTP 401 é falha de autenticação, não aprovação de autorização. Erros de integridade/assinatura/RPC inexistente e status inesperados também não contam como bloqueio de segurança aprovado. Leituras vazias são classificadas hidden_or_not_found: C não deve poder distinguir existência de recurso privado; a existência de B foi confirmada separadamente, sem atribuir a leitura administrativa a C.

O fingerprint dos snapshots é comparado somente em memória. Manifesto/saída não guardam conteúdo de perfis, dados retornados, senhas, cookies, JWTs ou mensagens brutas do provedor. Guardam cenário, categoria, status/código limitado, flags de integridade, run, IDs sintéticos conhecidos e IDs de requisição. Se alguma RPC indevida retornar um UUID de fixture inesperada, ele é preservado apenas no manifesto para investigação; não há limpeza/compensação automática.

**Escopo da integridade do runner:** perfil e grupo A, incluindo proprietário/C/membros/players autorizados. C não tem permissão para fotografar todo o estado privado de B; a conferência administrativa/owner de B após execução deve continuar separada. Negação 42501 reverte o statement da RPC; isso não deve ser descrito como uma leitura privada de B feita por C. Se uma operação tiver sucesso inesperado ou houver erro de rede, parar, guardar o manifesto e conferir estado por leitura autorizada antes de qualquer nova tentativa.

### Execução única no Codespaces

Configurar TEST_USER_C_EMAIL e TEST_USER_C_PASSWORD em secrets do Codespaces, sem enviar valores no chat. Reiniciar o Codespaces se necessário para carregar secrets novos. Reutilizar as variáveis públicas do projeto e TEST_ACCOUNTS_ARE_SYNTHETIC=1. Template sem credenciais: tests/stage0032-member-c.env.example. O arquivo work/stage0032.test.env existente não foi lido, sobrescrito ou publicado por esta tarefa; variáveis exportadas têm precedência sobre --env-file.

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-member-c.mjs --check
node --env-file=work/stage0032.test.env scripts/test-stage0032-member-c.mjs
```

O primeiro comando deve mostrar cinco campos true (URL, chave publicável, e-mail C, senha C e declaração de conta sintética). Só então executar o segundo uma vez. Não executar a suíte integral A/B nem reinserir o vínculo. O manifesto será work/stage0032-member-c-RUN_UUID.json, com modo 0600. As tentativas administrativas são requisições reais sobre fixtures, com expectativa de recusa; em sucesso indevido, o executor para e preserva evidências, sem excluir ou restaurar registros às cegas. Compartilhar somente saída sanitizada. --check é presença, não valida credenciais.

### Verificações locais e resultado desta tarefa

Formatação, lint, typecheck, 117 testes em 14 arquivos e build passaram. Novos testes unitários cobrem identidade equivocada/não confirmada, papéis incorretos, owner duplicado/substituído, diferenciação 403/401/404/erros SQL, vazamento de mensagens e detecção de mutações/ordenação em snapshots. Esses testes usam dados locais e não são JWT real. Sintaxe e --check do novo executor passaram; testes de permissões remotos não iniciados.

| Verificação solicitada       | Resultado verificável nesta execução                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Conta C confirmada/vinculada | PASS administrativo somente leitura                                                          |
| Autenticação JWT de C        | BLOQUEADO — credenciais não acessíveis neste executor                                        |
| Leitura autorizada via C     | NÃO EXECUTADA                                                                                |
| Bloqueio do grupo B via C    | NÃO EXECUTADO                                                                                |
| Bloqueio de autoelevação     | NÃO EXECUTADO                                                                                |
| Administração indevida       | NÃO EXECUTADA                                                                                |
| Integridade atual            | C player/active e owner original único confirmados por SELECT; pós-tentativas ainda pendente |

Nenhuma fixture foi criada, alterada ou excluída por esta tarefa. 4ª Força, Grupo Teste 2, usuários reais e relacionamentos preservados. O aceite de riscos de ferramentas registrado anteriormente não foi ampliado. **Etapa 003.2 permanece aberta** para executar este cenário JWT e a matriz de interfaces privadas, além das demais pendências já discriminadas.

## Conta técnica C — preparação interrompida (22/10/2026)

O proprietário autorizou expressamente criar um vínculo comum de C exclusivamente em grupo sintético. Essa autorização está registrada e não precisa ser solicitada novamente para o mesmo escopo. Ao pedir identificação inequívoca, o proprietário informou: **a conta C não existe**. Portanto, a preparação foi interrompida antes de inserir qualquer vínculo ou iniciar autenticação. Nenhuma conta/senha foi criada administrativamente e a confirmação de e-mail não foi desabilitada.

Leituras prévias realizadas: AGENTS.md, ARCHITECTURE.md, DATABASE.md, documentação atual e migrations; catálogo remoto confirmou colunas de profiles/players/groups/group_members, papéis owner/admin/player/guest, estados active/invited/suspended/left, FK para players/groups, unicidade por grupo/player, índice de único owner ativo e triggers de validação/auditoria/owner. Grupos sintéticos audit-0032-a-8467145b-fb16-4cbd-89f5-3cf149b3a830 e audit-0032-b-8467145b-fb16-4cbd-89f5-3cf149b3a830 existem e cada um tem um owner ativo. Não foi necessário criar grupo novo nem consultar/listar identidades pessoais para adivinhar C.

Operação futura delimitada: após C existir, estar confirmada e ter player próprio criado pelo onboarding normal, validar UUID técnico e grupo sintético A; inserir apenas um vínculo novo role=player/status=active, mantendo as constraints/triggers e o owner. A auditoria de INSERT é automática; sem simular JWT/sub para atribuir falsamente a operação administrativa a um usuário. Registrar associação e contexto administrativo no manifesto privado. Nenhum UPDATE em vínculos existentes, nenhum owner/admin concedido, nenhuma mudança de policy/grant/função/trigger.

| Verificação desta tentativa                              | Resultado                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Conta C existente e confirmada                           | BLOQUEADO — conta inexistente, conforme proprietário                     |
| Vínculo comum                                            | BLOQUEADO — não inserido                                                 |
| JWT real de C                                            | BLOQUEADO — não autenticado                                              |
| Acesso autorizado, autoelevação e administração indevida | NÃO EXECUTADOS                                                           |
| Isolamento multi-tenant de C                             | NÃO EXECUTADO                                                            |
| Integridade                                              | Nenhuma mutação realizada; não equivale a aprovação dos testes negativos |

**Ação necessária do proprietário:** criar Auditoria BoraFute C com e-mail técnico exclusivo pelo /signup do domínio de homologação, confirmar o link no mesmo navegador/origem e entrar uma vez para completar onboarding. Informar apenas o UUID da conta no Supabase Auth e confirmar que é exclusiva de homologação. Senha/JWT/cookies nunca no chat. Para execução posterior no Codespaces, disponibilizar TEST_USER_C_EMAIL e TEST_USER_C_PASSWORD somente em secrets/arquivo ignorado. O executor Codex atual não tem Codespaces nem essas credenciais; não declarar JWT real antes da execução apropriada.

Nenhuma fixture criada/excluída, nenhum dado de 4ª Força/Grupo Teste 2 alterado. Alteração exclusivamente documental, com formatação conferida; não repetir unidades/build/SQL ou testes reais para este registro de bloqueio. A homologação de interfaces privadas continua independente e pendente. O aceite de riscos de desenvolvimento registrado no commit 10e8b04 foi preservado, sem ampliar seu escopo.

## Aceite temporário de risco — dependências de desenvolvimento (22/10/2026)

**Decisão explícita do responsável pelo projeto:** aprovado o aceite temporário dos nove avisos de severidade alta do `npm audit` restritos às dependências de desenvolvimento descritas neste relatório, até **05/11/2026**, com reavaliação antecipada se houver atualização compatível ou mudança de exposição/uso.

**Limites e controles do aceite:** não inclui vulnerabilidades de produção, novos achados ou eventuais riscos administrativos do Supabase; não autoriza merge na `main`, publicação em produção ou relaxamento de RLS/autenticação. Manter dependências travadas; evitar execução de geradores, registries e glob patterns não confiáveis, especialmente com secrets; revisar permissões de CI e ferramentas antes de executar código não revisado. Mitigações documentadas não equivalem a comprovação de controles efetivamente aplicados.

**Monitoramento:** reexecutar `npm audit` e `npm audit --omit=dev` até 05/11/2026; reavaliar imediatamente ao surgir correção compatível ou mudar o cenário de exposição. Se um alerta alcançar produção, o aceite não se aplica e requer nova avaliação. O aceite encerra apenas a decisão de risco residual das ferramentas de desenvolvimento; a **Etapa 003.2 permanece aberta** pelas verificações SSR reforçada, membro comum com JWT real e matriz privada de interface, além das revisões administrativas documentadas.

## Retomada da homologação final — 22/10/2026

**As quatro pendências não foram aprovadas nesta retomada.** develop confirmado no GitHub em 5e7f470. Executor disponível /workspace/work/close32, sem /workspaces/aplicativo-futebol anexado e sem secrets/runtime variables configurados (readiness atual consultada). --check na cópia independente mostrou as nove variáveis ausentes; não foi iniciado login nem SSR remoto. O arquivo privado do Codespaces não foi lido/copied e o manifesto original não está acessível aqui. Não confundir ausência de acesso do executor com falha dos controles do produto.

### 1. SSR reforçado — pendente de execução no Codespaces

Executar somente os dois comandos abaixo no Codespaces, com nove campos presentes, mesmos usuários técnicos A/B e manifesto original preservado:

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --check
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --ssr-only 8467145b-fb16-4cbd-89f5-3cf149b3a830
```

Não executar a suíte completa. Critério: seis relatórios passed=true; identity A/B HTTP 200 com ID verificado internamente; own_group A/B HTTP 200 com conteúdo esperado; foreign_group A/B not-found válido e **privateDataPresent=false**. HTTP 200 em streaming não basta para reprovação nem aprovação. Não repetir em FAIL: registrar account/scenario/status/category/code/redirect/privateDataPresent, run e caminho do novo manifesto. Não compartilhar corpo, Cookie, Location bruto, tokens ou valores de configuração.

A execução anterior de seis checkpoints continua válida para a cobertura daquela versão. Não há evidência nova do reforço explícito de marcadores privados, e nenhum resultado histórico foi reconstituído.

### 2. Terceira conta / membro comum — bloqueio confirmado no fluxo existente

Inspeção de src/features/groups/actions.ts, policies e RPCs: a aplicação oferece create_group_once e add_guest_once; o convidado tem user_id nulo. create_invitation cria convite, mas não existe fluxo público implementado de aceite/resgate ou associação de uma conta autenticada ao grupo. AGENTS.md explicitamente registra que convites não têm aceite público e proíbe introduzir claim de convidado sem nova decisão. group_members tem SELECT de cliente, sem INSERT direto concedido. Portanto, cadastrar C, criar um convite ou um convidado **não produz um membro autenticado comum**. Reaproveitar A/B owners ou JWT simulado não satisfaz esse cenário.

Procedimento mínimo proposto, **não autorizado nem executado**, sem nova funcionalidade:

1. Criar C pelo cadastro normal, confirmar no mesmo navegador/origem e completar onboarding. Conta técnica exclusiva; secrets TEST_USER_C_EMAIL/PASSWORD somente no executor privado. Não usar conta pessoal, jogador real ou conta administrativa.
2. Identificar em manifesto privado a identidade/player técnico de C e o grupo sintético de A da execução original. Confirmar que A permanece único owner, B não participa desse grupo e C não tem vínculos prévios. Não usar 4ª Força nem Grupo Teste 2.
3. Solicitar autorização específica para uma fixture administrativa delimitada: **uma linha nova em public.group_members**, ligando o player técnico C ao grupo sintético A, com role=player e status=active. Isso concede somente o vínculo comum necessário ao teste, nunca owner/admin. Não transformar convidado existente, trocar user_id, transferir owner, alterar ACL/RLS ou conceder privilégio a C.
4. Antes de executar, preparar/revisar transação com IDs privados exatos, precondições que abortem por qualquer divergência, lock do grupo e pós-condições (uma associação comum; owner único inalterado). Só COMMIT após verificação; nenhum DELETE posterior automático. Registrar ID da associação e autorização em manifesto. O SQL exato deve ser revisado/testado antes da execução; este roteiro não autoriza sua aplicação.
5. A operação administrativa serve apenas à preparação da fixture. Todas as provas de autorização devem usar novo login/getUser real de C e chave publicável; nunca cliente privilegiado representando C.

Após o vínculo aprovado, suíte direcionada de C deve comprovar: leitura permitida do grupo A e dados autorizados; grupos/membros/jogadores exclusivos de B invisíveis; UPDATE direto de papéis recusado/zero linhas; set_member_role para owner/admin recusado, inclusive em si; alterações em papéis/status de terceiros recusadas; transfer_ownership, add_guest_once e create_invitation administrativos recusados no grupo A e no grupo B. Usar somente IDs sintéticos. Reconsultar com os owners para confirmar papel player de C, unicidade dos owners e ausência de mutações inesperadas. Se uma chamada indevida tiver sucesso, parar e registrar; não limpar evidências nem relaxar policies. Nenhum desses testes C foi executado nesta sessão.

### 3. Interface privada — roteiro e matriz ainda não executados

Sem navegador conectado a uma sessão técnica neste executor, não foram geradas capturas autenticadas nem reutilizadas capturas públicas como se fossem privadas.

| Combinação pendente | Viewport de referência | Conteúdo a verificar                             |
| ------------------- | ---------------------- | ------------------------------------------------ |
| Desktop / claro     | 1440 × 900             | dashboard, grupo, elenco, formulários, navegação |
| Desktop / escuro    | 1440 × 900             | mesmos fluxos, contraste/foco/erros              |
| Celular / claro     | 390 × 844              | mesmos fluxos, teclado, labels e overflow        |
| Celular / escuro    | 390 × 844              | mesmos fluxos, contraste e navegação             |

Usar perfis separados de A/B (e C quando a fixture estiver autorizada). Para cada combinação: entrar normalmente, abrir dashboard/grupo próprio/elenco, navegar formulários sem criar novas fixtures desnecessárias, verificar mensagens e foco; abrir a URL sintética do outro grupo e confirmar tela not-found sem nome/ID/detalhes privados. Registrar status da matriz, viewport/tema, erro de console apenas por categoria sanitizada e captura recortada sem e-mail/cookies/tokens. Guardar artefatos em work/ ignorado. Bloqueio visual complementa, não substitui Data API/RPC/JWT. Não usar dados reais nem incluir conteúdo privado de 4ª Força.

### 4. Auditorias atualizadas e proposta de decisão de risco

npm audit --json novamente: **nove altos, zero críticos/moderados**. npm audit --omit=dev --json: **zero achados**. Consultas de versões e npm outdated não identificaram atualização compatível validada que corrigisse a cadeia atual; braces latest=3.0.3, micromatch latest=4.0.8 e fast-glob latest=3.3.3 continuam na cadeia afetada. Não houve atualização/downgrade adicional, audit fix ou mudança de lockfile.

Pacotes: braces@3.0.3, micromatch@4.0.8, fast-glob@3.3.1/3.3.3, @next/eslint-plugin-next@16.4.2, eslint-config-next@16.4.2, @shadcn/registry@0.2.0, shadcn@4.22.1, @ts-morph/common@0.27.0 e ts-morph@26.0.0. Caminhos, severidade propagada e correção do crítico tar/CLI permanecem detalhados na consolidação anterior. Zero em produção não certifica segurança total nem elimina exposição de instalação/CI.

**Decisão técnica proposta: aceite temporário restrito a desenvolvimento, pendente de aprovação do proprietário.**

- Alcance: DoS por padrões profundamente aninhados na cadeia braces/glob usada por lint/geradores; não foi demonstrado caminho runtime de produção.
- Condições: usar apenas padrões/configurações/repositório revisados; não executar registries/geradores não confiáveis em sessão com secrets; jobs de PR não confiável sem credenciais; manter lockfile e verificar auditoria em cada mudança de ferramentas. Não usar contorno de peers ou downgrade automático de Next/eslint/shadcn.
- Medidas comprovadamente presentes: versões/lockfile fixos; CLI vulnerável substituído; produção auditada sem achados. Não há workflow versionado em .github nesta cópia; políticas de CI/organização e isolamento de secrets não foram certificados por esta inspeção.
- Revisão até **05/11/2026**, ou antes se houver versão compatível corrigida, evidência de exploração, entrada de padrões não confiáveis, mudança de exposição ou proposta de publicação em produção. Prazo expirado sem revisão não equivale a renovação.
- Aprovação deve registrar proprietário responsável, data, alcance e condições. **Não há aceite registrado nesta sessão.** Isso não autoriza produção.

Security Advisor consultado separadamente: sete WARN e três INFO. Quatro APIs autenticadas SECURITY DEFINER permanecem fronteira intencional documentada/testada; três INFO são tabelas deliberadamente fechadas. Dois WARN da função gerenciada rls_auto_enable exigem revisão de privilégio mínimo pelo administrador, e proteção de senhas vazadas continua desabilitada, sujeita a configuração/plano. Não foram alteradas funções, RLS, permissões ou Supabase Auth. Não remover avisos abrindo tabelas.

### Parecer desta retomada

| Pendência                              | Resultado                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| SSR reforçado / privateDataPresent A/B | NÃO EXECUTADO — exige Codespaces e manifesto privado                                         |
| Membro comum com JWT real              | NÃO EXECUTADO — C e vínculo comum indisponíveis; fluxo de aceite não implementado            |
| Interface privada: quatro combinações  | NÃO EXECUTADO — falta navegador autenticado acessível                                        |
| Dependências                           | Crítico corrigido anteriormente; nove altos dev com aceite temporário proposto, não aprovado |
| Security Advisor                       | Sete WARN/três INFO; revisão administrativa residual documentada                             |
| Conclusão                              | **Etapa aberta; sem liberação formal da Etapa 004 ou produção**                              |

Alteração desta tentativa exclusivamente documental; formatação conferida. Não foi necessário repetir build, unidades/SQL ou autenticação já aprovados para essa mudança. Nenhum dado/fixture excluído, vínculo criado, permissão alterada ou configuração externa modificada. Histórico abaixo preservado.

## Consolidação técnica — 22/10/2026

**Parecer atual: etapa ainda aberta.** Auth/JWT, Data API/RPC e os seis checkpoints SSR têm evidência real; o alerta crítico de dependências foi corrigido. Permanecem validações essenciais e decisões de risco discriminadas abaixo. Continuar desenvolvimento não equivale a autorizar publicação.

### Evidência SSR recebida do proprietário

Captura do terminal Codespaces, após fast-forward para 32fd804, mostra nove variáveis presentes e execução única do modo ssr_only com o manifesto de origem 8467145b-fb16-4cbd-89f5-3cf149b3a830. Resultado PASS, run e0b9b9f3-9c86-4940-a1f7-7be5ec2842d9, manifesto privado work/stage0032-e0b9b9f3-9c86-4940-a1f7-7be5ec2842d9.json. Não houve acesso ao arquivo privado neste executor; a fonte dessa evidência é a saída sanitizada apresentada pelo proprietário.

| Checkpoint real SSR                                                              | A    | B    |
| -------------------------------------------------------------------------------- | ---- | ---- |
| /api/me: HTTP 200, identidade correspondente                                     | PASS | PASS |
| Grupo próprio: HTTP 200 e conteúdo esperado                                      | PASS | PASS |
| Grupo alheio: HTTP 200, noindex/boundary not-found, NEXT_HTTP_ERROR_FALLBACK;404 | PASS | PASS |

**Seis aprovados, zero reprovados nessa execução isolada.** Nenhum redirect nem bloqueio Vercel foi indicado. A exigência antiga de HTTP 404 em todos os casos era incorreta para notFound() após streaming. O resultado histórico da execução integral não foi recuperado: ela continua registrada como FAIL agregado na fase ssr; a execução posterior fornece evidência nova.

Reforço do executor neste fechamento: acessos ao grupo alheio agora reprovam também se o corpo contiver o ID do convidado daquele grupo ou o nome sintético dos convidados, mesmo junto a uma boundary not-found válida. Só persiste privateDataPresent=true/false, nunca os marcadores ou o HTML. Testes unitários injetam essas informações em uma resposta com marcador 404 e comprovam rejeição. O manifesto usado em --ssr-only deve conter dois IDs sintéticos válidos. Isso amplia a cobertura de ausência de dados, não prova ausência de toda possível forma de vazamento. **A captura anterior não continha esse novo checkpoint explícito; não atribuir sua aprovação retroativamente.**

### Dependências: correção aplicada e auditoria atual

Antes: npm audit --json reproduziu 11 pacotes afetados (1 crítico, 9 altos, 1 moderado); npm audit --omit=dev --json, zero achados. O CLI supabase@2.81.3 fixava tar@7.5.11: simples atualização transitiva não bastava.

Atualizado exclusivamente o CLI de…273 tokens truncated…de desenvolvimento, não nove explorações independentes:

| Pacote afetado           | Versão        | Caminho de dependência / alcance                           |
| ------------------------ | ------------- | ---------------------------------------------------------- |
| braces                   | 3.0.3         | micromatch → braces; DoS por padrão profundamente aninhado |
| micromatch               | 4.0.8         | fast-glob → micromatch → braces                            |
| fast-glob                | 3.3.1 / 3.3.3 | ESLint Next ou ferramentas shadcn → fast-glob              |
| @next/eslint-plugin-next | 16.4.2        | eslint-config-next → plugin → fast-glob                    |
| eslint-config-next       | 16.4.2        | Dependência direta de lint; propaga a cadeia anterior      |
| @shadcn/registry         | 0.2.0         | shadcn → registry → fast-glob                              |
| shadcn                   | 4.22.1        | CLI/gerador direto, com fast-glob/registry/ts-morph        |
| @ts-morph/common         | 0.27.0        | shadcn → ts-morph → common → fast-glob                     |
| ts-morph                 | 26.0.0        | Ferramenta transitiva do shadcn, não runtime do aplicativo |

braces 3.0.3 ainda era a versão mais recente consultada e consta afetada por [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Nenhuma versão corrigida compatível dessa cadeia foi certificada. npm sugere eslint-config-next 14.2.35 e shadcn 1.0.0 para parte da árvore: são downgrades, com impacto incompatível a avaliar, e não foram aplicados. Para ts-morph/common, fixAvailable=true não informa uma versão exata segura para a cadeia atual; não foi confundido com correção validada.

**Risco residual:** DoS em ferramentas que processem padrões maliciosos. Não demonstrado no runtime de produção, mas devDependencies podem executar em instalação/CI. Mitigação proposta: não executar geradores/registries/globs não confiáveis com secrets; restringir jobs com credenciais a código revisado; manter versões fixas e monitorar correção upstream. Essas recomendações não significam alteração efetiva de configuração CI. Decisão ainda necessária: aceite temporário explícito do risco em desenvolvimento ou substituição/remoção compatível das ferramentas. Aceite não presumido apenas porque --omit=dev ficou limpo.

### Verificações finais executadas

- npm ci limpo, CLI 2.121.0 e help dos três comandos locais: PASS.
- Formatação, lint, typecheck, 95 testes unitários em 13 arquivos e build: PASS; unidades usam transporte sintético, não nova autenticação real.
- npm run db:test: sete migrations em PostgreSQL local descartável, 70 asserções com authenticated/anon não privilegiados, regressões da ponte, smoke Etapa 003 e seis corridas: PASS.
- Concorrência: última vaga, convidado idempotente, transferência de owner, criação idempotente de grupo, disputa de slug e grupos independentes; owner único/rollback verificados.
- Histórico remoto consultado somente leitura: sete migrations continuam mapeadas, incluindo local 20261020161609 → remota 20261020162554. Nenhuma pendente no manifesto e nenhuma reaplicada.
- Security Advisor atualizado: sete WARN e três INFO. Quatro APIs SECURITY DEFINER autenticadas e três tabelas deliberadamente fechadas mantêm as justificativas anteriores. Dois WARN rls_auto_enable e proteção contra senhas vazadas desabilitada permanecem para revisão administrativa; nenhuma permissão/Auth foi alterada.
- Autenticação/JWT reais não repetidos nesta execução; nenhuma fixture ou dado remoto criado, alterado ou excluído. 4ª Força, Grupo Teste 2 e fixtures preservados.

### Matriz consolidada e critérios ainda abertos

| Controle                                                  | Evidência / situação                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Auth A/B, identidades distintas                           | PASS real, execução original documentada no Codespaces                                                     |
| Data API/RPC e isolamento de leitura/escrita A/B          | PASS real nos cenários efetivamente executados                                                             |
| Owner, convidado, idempotência e integridade              | PASS real nos cenários da suíte; concorrência ampliada PASS em PostgreSQL local                            |
| SSR identidade/grupo próprio/grupo alheio                 | PASS real, seis checkpoints da captura posterior                                                           |
| Rejeição explícita de marcadores privados em resposta SSR | PASS unitário novo; execução real do reforço ainda pendente                                                |
| Membro autenticado comum tentando autoelevação            | SQL local cobre autorização; cenário JWT de membro comum ainda não demonstrado                             |
| Interface privada desktop/celular/claro/escuro            | Fluxos funcionais informados pelo proprietário; matriz privada de dispositivos/temas ainda não demonstrada |
| Crítico tar/CLI                                           | Corrigido na árvore instalada e lockfile                                                                   |
| Nove altos dev / Advisor residual                         | Classificados; aceite temporário/remediação e revisão administrativa pendentes conforme alcance            |

**Bloqueios para encerramento formal:** registrar a validação SSR reforçada de ausência dos marcadores privados; cenário JWT de membro comum sem privilégios; matriz privada de UI/dispositivos/temas; decisão documentada para o risco residual de ferramentas. Não converter SQL simulado em JWT real nem capturas públicas em UI privada homologada.

Para o reforço SSR, após sincronizar develop e confirmar configuração, basta executar uma vez o mesmo --ssr-only com o manifesto original; não repetir a suíte completa. O relatório agora inclui privateDataPresent=false em ambos os checkpoints foreign_group. Não é necessário repetir cadastro/confirmação/recuperação já homologados por causa desta atualização do CLI.

**Liberação formal da Etapa 004: pendente dos bloqueios acima.** Os resultados não autorizam produção, merge ou alterações administrativas externas. Nenhuma vulnerabilidade crítica conhecida permanece no npm audit desta árvore, mas isso não certifica todo o sistema. Histórico de evidências e falhas abaixo preservado.

## Diagnóstico SSR e sincronização — 21/10/2026

GitHub confirmou develop em 5dbe621b2a9d51530e303853be19d71c1a39c6de, incluindo os commits antes locais. Inspeção feita em cópia independente atualizada por blobs GitHub em /workspace/work/ssr-fix, preservando a cópia anterior e os arquivos privados do Codespaces. O Codespaces e o manifesto privado da execução 8467145b-fb16-4cbd-89f5-3cf149b3a830 não estão anexados a este executor. Nenhum resultado real novo foi inventado e a suíte completa não foi repetida.

### Defeito comprovado no executor, causa histórica ainda não confirmada

A asserção antiga exigia HTTP 404 para /groups/[slug] alheio. O código usa notFound() após consultas assíncronas e possui app/loading.tsx. A documentação da versão instalada explica que, após começar streaming, notFound() mantém HTTP 200 e injeta noindex. Referências: [not-found](https://nextjs.org/docs/app/api-reference/file-conventions/not-found), [loading/status codes](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes); também conferido em node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md.

Reprodução local isolada, sem Auth/dados: Next 16.4.2, loading boundary, rota dinâmica aguardando uma operação e chamando notFound(). HTTPS remoto não foi envolvido; requisição HTTP localhost retornou 200, meta robots noindex e instrução React de boundary com digest NEXT_HTTP_ERROR_FALLBACK;404. O HTML pode conter apenas o shell e a instrução para renderização no cliente, sem h1 final. Isso demonstra uma expectativa incorreta no runner, mas **não prova que a execução histórica falhou nessa asserção**: ela também poderia ter falhado antes em /api/me ou no grupo próprio.

Correção restrita ao executor/observabilidade; aplicação, SSR Supabase, cookies, proxy, RLS e controles de sessão inalterados:

- scripts/stage0032-ssr.mjs, com declaração de tipos, centraliza seis checkpoints (três por conta), interrompendo na primeira falha.
- /api/me exige 200 e ID correspondente; grupo próprio exige 200 com heading do grupo sintético, rejeitando telas genéricas, preparação e erros.
- Grupo alheio exige resultado not-found sem heading do grupo: 404 ou 200 acompanhado de noindex e heading not-found real ou boundary 404 específico do Next/React. 200 genérico, componente not-found apenas pré-carregado ou texto solto com o digest não são aceitos. A detecção do boundary está vinculada à versão do framework e deve ser revisada ao atualizar Next/React.
- Relatório por checkpoint: conta A/B, cenário, rota parametrizada, status observado/esperado, categoria, tipo de redirect, marcador 404 conhecido e indicação heurística de proteção Vercel. Não persiste HTML, headers, Location, cookies, JWT, IDs de usuário ou mensagens brutas de exceção.
- Categorias distinguem rejeição de sessão (401/redirect login), proteção Vercel identificável, redirect inesperado, acesso negado, indisponibilidade/configuração, erro servidor, JSON/identidade inválidos e conectividade/timeout. São observações, não atribuição automática de causa raiz.
- Modo --ssr-only RUN_UUID autentica novamente A/B, valida identidades distintas e reutiliza slugs sintéticos do manifesto original; não executa as fases de onboarding/mutação/Data API/RPC da suíte. Cria outro manifesto privado e não sobrescreve o original. As páginas continuam usando seus guardas e onboarding idempotente normal. Nenhuma fixture é excluída.

### Validação necessária no Codespaces — somente SSR

Com develop atualizado, secrets válidos, contas confirmadas e o manifesto original preservado:

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --check
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --ssr-only 8467145b-fb16-4cbd-89f5-3cf149b3a830
```

Executar o segundo comando uma única vez, com os nove campos presentes e conectividade. A entrada exige UUID válido, manifesto na fase ssr, dois grupos e slugs audit-0032-a/b correspondentes ao run. Se faltarem manifesto/fixtures ou o grupo tiver sido renomeado, parar e revisar; não recriar fixtures cegamente nem expor seu conteúdo.

Resultado deve conter mode=ssr_only e ssr com até seis relatórios sanitizados. PASS só quando todos os seis passarem. Um resultado streamed_not_found confirma a semântica da resposta atual, não recupera o status perdido da execução histórica. Se houver FAIL, guardar cenário/status/categoria/redirect e novo run/manifesto; não repetir automaticamente. Corpo privado e credenciais não devem ser compartilhados. Bloqueio Vercel requer revisar a proteção/associação existente sem desabilitá-la ou atualizar alias automaticamente. SSR-only não substitui navegador autenticado nem prova adicional de membro comum.

### Verificações e dependências

Formatação, lint, typecheck, 93 testes unitários em 13 arquivos e build passaram nesta correção. O precheck local indicou ausência das nove variáveis na cópia independente; nenhum teste JWT/SSR remoto foi iniciado. Testes novos usam transporte sintético para validar a observabilidade, não JWT real. Reprodução local de streaming não foi apresentada como homologação Supabase.

Auditoria somente leitura repetida: npm audit --omit=dev --audit-level=moderate --json retornou zero achados; npm audit --json reproduziu 11 pacotes (1 crítico, 9 altos, 1 moderado). Crítico tar na árvore dev do CLI Supabase; sem evidência de runtime de produção afetado nessa árvore, mas ferramentas/instalação/CI continuam expostas. npm indica supabase 2.121.0 como correção para o CLI atual. Avaliar atualização isolada fixada e suas mudanças de CLI/instalador, instalação limpa, auditorias, comandos locais e regressões antes de aplicar; alternativa tar 7.5.22 somente após compatibilidade comprovada. Cadeia braces/micromatch/fast-glob nas ferramentas requer correção upstream ou revisão compatível; não aplicar downgrades automáticos de shadcn/eslint-config-next. Nenhuma dependência/lockfile alterado e nenhum audit fix executado.

Etapa 003.2 permanece incompleta: falta o resultado SSR real detalhado e tratamento das pendências de segurança, além da interface privada autenticada e cenários essenciais remanescentes. Histórico abaixo preservado; registros antigos de ausência dos commits/contas não descrevem o estado GitHub atual.

## Execução real no Codespaces — 21/10/2026

Ambiente confirmado: Codespaces reconstruído, usuário `node`, Node.js v24.21.0, npm 11.19.0, dependências instaladas, branch `develop`. As branches `backup/recovery-3cd2f9a` e `backup/recovery-develop` existem. Após `git fetch origin`, os quatro commits locais foram preservados e o único commit remoto (`c470585`) foi integrado sem conflitos por merge; nenhum commit foi descartado.

O precheck executado exatamente com `node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --check` confirmou presença para os nove parâmetros obrigatórios. A saída continha somente indicadores de presença, sem valores. Em seguida, a suíte real foi executada uma única vez, sem JWTs simulados:

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs
```

Run `8467145b-fb16-4cbd-89f5-3cf149b3a830`; resultado agregado **FAIL**, fase `ssr`. As contas A e B autenticaram por senha e `getUser` confirmou identidades distintas. A execução passou por onboarding idempotente; criação idempotente dos grupos e convidados sintéticos; leituras sem acesso cruzado; rejeição de RPC e escrita direta cruzadas; rejeição de RPC anônima e de autoelevação de convidado; e invariantes de owner e convidado. Essas verificações usaram sessões JWT reais na Data API/RPC, não claims simuladas.

A falha foi reportada somente como fase `ssr`; o runner não registra qual resposta/status ou asserção individual falhou. Portanto, não há evidência suficiente para atribuir a falha a `/api/me`, acesso SSR ao próprio grupo ou ocultação SSR do grupo alheio. Não houve nova tentativa. Não se declara aprovação de SSR nem conclusão da suíte.

O manifesto privado `work/stage0032-8467145b-fb16-4cbd-89f5-3cf149b3a830.json` registra duas fixtures sintéticas de grupo e duas de jogador/convidado, além de seis IDs de requisição. O runner não executa exclusões nem restaura perfis; as fixtures permanecem para revisão/limpeza autorizada. A execução não teve como alvo 4ª Força, Grupo Teste 2 nem seus dados. Nenhum token, cookie, e-mail ou senha foi incluído neste registro.

- **Precheck:** PASS — nove parâmetros presentes; valores não exibidos.
- **Autenticação A/B e identidades distintas:** PASS — login real e `getUser` para ambas.
- **Onboarding, Data API e RPCs de criação/idempotência:** PASS.
- **Isolamento de leituras e rejeição de escrita/RPC cruzadas:** PASS.
- **Owner único, vínculo do convidado e bloqueio de autoelevação:** PASS.
- **RPC anônima:** PASS — acesso rejeitado.
- **Rotas SSR:** FAIL — fase reportada; asserção específica não registrada.
- **Preservação dos dados reais:** PASS — somente fixtures sintéticas; sem exclusões.

### npm audit desta retomada — separado dos testes funcionais

`npm audit --json` na árvore completa reportou **11 pacotes afetados: 1 crítico, 9 altos e 1 moderado**. Todos pertencem às ferramentas de desenvolvimento diretas ou transitivas; não houve alerta na saída desta execução que identificasse pacote runtime de produção. Pacotes diretos sinalizados: `eslint-config-next` (alto), `shadcn` (alto) e `supabase` CLI (moderado). Entre os transitivos estão `tar` (crítico), `braces`, `fast-glob`, `micromatch`, `@next/eslint-plugin-next`, `@shadcn/registry`, `@ts-morph/common` e `ts-morph` (altos).

O npm sugeriu atualizações que incluem mudanças major/downgrades em ferramentas; nenhuma foi aplicada. Não foi executado `npm audit fix`, alteração forçada, nem modificado `package.json` ou lockfile. Os alertas permanecem pendentes de avaliação de compatibilidade e correção segura; a classificação do npm é de dependências, não evidência de exploração no aplicativo.

## Nova tentativa de execução JWT — 21/10/2026

**Bloqueada; nenhum teste JWT real executado ou aprovado nesta tentativa.**

Inspecionados docs/STAGE0032.md, tests/stage0032.env.example e scripts/test-stage0032-integration.mjs. Executor gerenciado sem secrets, variáveis de runtime ou identidades externas configuradas; as quatro variáveis de contas A/B estão ausentes. Nenhum arquivo de credenciais foi lido ou publicado. Criado somente work/stage0032.test.env com placeholders, modo 0600 e exclusão pelo Git confirmada. Precheck executado exatamente:

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --check
```

Resultado: faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e as quatro variáveis TEST_USER_A/B_EMAIL/PASSWORD. SITE_URL e os dois consentimentos do template estão presentes. Exit 0 de --check significa apenas que a inspeção terminou; não comprova configuração completa nem autenticação. A chamada completa não foi iniciada sem duas contas reais confirmadas.

Sondagem sem credenciais a /auth/v1/health: HTTP 000; execução normal não alcançou o proxy e a tentativa com acesso de rede do executor recebeu CONNECT 403. Política vigente não permite o host Supabase. Não foi tentado contornar o proxy. Nenhum usuário, grupo ou convidado remoto foi criado/alterado/excluído.

### Diagnóstico posterior no Codespaces — 21/10/2026

O precheck confirmou as nove variáveis obrigatórias. Uma execução integral, sem repetição, autenticou a conta A e falhou na conta B durante `signInWithPassword`: `invalid_credentials`, HTTP 400, `Invalid login credentials`. Não houve rate limit; a fase de criação de identidade/fixtures não foi alcançada, portanto nenhuma linha foi criada ou alterada. O manifesto dessa execução registra somente a conta, etapa e erro técnico sanitizado.

A resposta genérica do Supabase não permite concluir se a causa da conta B é e-mail/senha incorretos, conta inexistente ou outro estado de autenticação, incluindo confirmação pendente conforme a configuração do projeto. O proprietário deve verificar a conta B pelo fluxo normal do aplicativo, confirmar que o endereço correto foi confirmado e, se necessário, usar o fluxo normal de recuperação de senha. Nenhuma senha foi redefinida e nenhum controle foi contornado. Não executar novamente até resolver essa verificação; se o provedor indicar rate limit em tentativa futura, aguardar a janela informada antes de nova execução.

Correção do executor: agora registra conta A/B, etapa e código/status/nome/mensagem de erro de autenticação, removendo credenciais, e-mails e tokens; testes locais cobrem a sanitização e diagnósticos de rate limit/conectividade. A suíte JWT completa segue pendente até que a conta B autentique normalmente.

### Retomada no Codespaces — 21/10/2026

O ambiente atual está em `develop`, contém o commit `3cd2f9a` e foi sincronizado com `origin/develop` sem descartar commits. O `--check` executado inicialmente com `work/stage0032.test.env` informou presença para todas as nove variáveis obrigatórias. Após o proprietário confirmar atualização/reinício, o `--check` foi executado novamente e as nove variáveis continuavam presentes. Isso valida somente configuração presente, não a validade das credenciais. A sondagem HTTPS ao health do Supabase recebeu HTTP 401 sem chave; o host estava alcançável, mas isso não é evidência de autenticação.

A primeira execução completa falhou na fase `authentication`, na conta B, durante `signInWithPassword`: `invalid_credentials`, HTTP 400, `Invalid login credentials`. O login real da conta A foi aceito; a leitura `getUser` de A e B e a comparação de identidades/JWTs distintos não foram alcançadas. Run `c8a34dae-31c0-44d0-9d89-db2aa4adb5a7`; manifesto privado `work/stage0032-c8a34dae-31c0-44d0-9d89-db2aa4adb5a7.json`.

Após a confirmação do proprietário de que atualizou a configuração da conta B e reiniciou o Codespace, foi feita uma única nova tentativa. Ela falhou novamente na autenticação B, com o mesmo código/status/mensagem. O login A foi aceito também nessa tentativa; as verificações `getUser`, comparação de JWTs e todas as fases posteriores permaneceram sem execução. Run `f128dacd-62c0-42ca-b7d8-1cc5796551c2`; manifesto privado `work/stage0032-f128dacd-62c0-42ca-b7d8-1cc5796551c2.json`. Ambos os manifestos registram zero grupos, jogadores e requisições criados. Nenhuma fixture ou alteração de dados foi realizada; 4ª Força, Grupo Teste 2 e jogadores existentes não foram tocados.

| Verificação da suíte                       | Resultado observado                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Login A                                    | PASS — `signInWithPassword` aceito nas duas tentativas; `getUser` não executado                  |
| Login B                                    | FAIL — `invalid_credentials` (HTTP 400) nas duas tentativas                                      |
| JWTs reais distintos                       | PENDENTE — não demonstrado, pois B não autenticou e a comparação não foi executada               |
| Isolamento de grupos / leituras cruzadas   | PENDENTE — não executado                                                                         |
| Supabase Data API                          | PENDENTE — não executada                                                                         |
| RPCs e permissões                          | PENDENTE — não executadas                                                                        |
| Bloqueio de escrita cruzada / autoelevação | PENDENTE — não executado                                                                         |
| Permissões legítimas de proprietários      | PENDENTE — não executadas                                                                        |
| Proteção das rotas SSR                     | PENDENTE — não executada                                                                         |
| Integridade dos dados nas tentativas       | PASS — ambos os manifestos sem fixtures/requisições; as suítes pararam antes de qualquer mutação |

Resultado agregado: dois checkpoints de login A aprovados, dois logins B reprovados e nenhum checkpoint posterior executado; o runner não fornece uma contagem global de asserts. Classificação da falha: **autenticação**, sem evidência de falha de RLS, autorização ou conectividade. Não repetir novamente sem nova confirmação explícita e diagnóstico da conta B pelo fluxo normal; conferir se o secret `TEST_USER_B_PASSWORD` efetivamente usado corresponde à credencial ativa e se a conta está confirmada. Nenhuma senha foi alterada pelo runner. A etapa continua bloqueada e não está aprovada.

### Preparação no Codespaces

1. Abrir o repositório correto, selecionar develop e atualizar por fast-forward. Usar Node 24/npm 11 e npm ci. Confirmar conectividade HTTPS ao projeto Supabase e a https://www.borafute.com.br, mantendo verificação TLS.
2. Reservar duas caixas de e-mail técnicas distintas e controladas pela equipe, exclusivas para homologação. Não usar contas pessoais, jogadores ou administradores existentes. Nomes de apresentação podem ser Auditoria BoraFute A e Auditoria BoraFute B; endereços e senhas não entram no Git/chat.
3. Em perfis de navegador separados para A e B, cadastrar cada conta pelo /signup de https://www.borafute.com.br (fluxo normal Supabase Auth). Definir senhas únicas no gerenciador de senhas da equipe. Confirmar cada e-mail no mesmo navegador/origem do respectivo cadastro, preservando PKCE. Não usar SQL, service_role ou confirmação administrativa para substituir o fluxo. Se a entrega falhar, registrar o bloqueio; não mudar Resend nem desativar confirmação.
4. Entrar uma vez com cada conta confirmada. Não ingressar nem editar 4ª Força ou Grupo Teste 2. O runner usa apenas slugs audit-0032-a/b-UUID e cria seus próprios registros sintéticos.
5. Configurar secrets do Codespaces acessíveis somente ao repositório: TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD e os valores públicos de configuração do projeto. Reiniciar o Codespaces para disponibilizar novos secrets. Alternativa: editar arquivo local ignorado com permissões 0600; nunca colar valores em comandos que ficam no histórico.
6. Preparar o arquivo sem sobrescrever um existente:

```sh
mkdir -p work
test -e work/stage0032.test.env || install -m 600 tests/stage0032.env.example work/stage0032.test.env
git check-ignore work/stage0032.test.env
```

Se usar secrets de ambiente, preencher também o arquivo com os mesmos valores ou remover as linhas vazias correspondentes; variáveis já exportadas têm precedência sobre --env-file no Node. URL Supabase deve ser https://hpbvtqvbtyioqjyelrpb.supabase.co, chave somente publicável sb_publishable_, SITE_URL https://www.borafute.com.br; ambos consentimentos devem ser 1.

7. Executar --check e verificar todos os campos true; só então executar:

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs
```

Não usar tee de tráfego, DEBUG de Auth, dumps de cookies ou impressão de variáveis. Em falha de autenticação, o runner registra no manifesto e na saída apenas a conta A/B, etapa, código/status/nome e mensagem técnica sanitizada; valores de credenciais, e-mails, JWTs e cookies são omitidos ou redigidos. Guardar somente resultado PASS/FAIL, fase, identificador de execução e caminho do manifesto. Em falha, não repetir cegamente: revisar a fase e os registros desta execução; diante de limite de requisições, interromper e aguardar a janela indicada pelo provedor antes de qualquer nova tentativa.

### Evidência exigida para encerramento

Registrar commit do runner, implantação Preview efetivamente servida por www, data/hora, resultado e fase, run e manifesto privado work/stage0032-UUID.json. Não publicar JWTs, cookies, e-mails ou senhas. Confirmar explicitamente os resultados de login A/B, Data API, RPCs, escrita/acesso cruzado, owner/convidados, SSR e anonimato. O manifesto mantém IDs dos registros sintéticos para revisão, sem exclusão automática.

O runner cobre owners A/B e a rejeição de promover convidado por setter genérico; não representa um membro comum autenticado tentando promover a si próprio. Esse cenário e navegador privado autenticado desktop/celular/claro/escuro continuam necessários para o encerramento integral da etapa. Não chamar --check, mocks ou claims SQL de prova JWT real.

4ª Força, seus jogadores e Grupo Teste 2 devem permanecer intactos. A autorização desta tentativa não permite limpeza desses registros. Sem merge/main, produção, DNS, Resend ou mudanças de RLS. A suíte remota e os critérios críticos continuam pendentes até evidências reais.

## Verificação do executor e auditoria npm — 21/10/2026

Esta execução ocorreu no Codex em /workspace/work/borafute, **não no Codespaces /workspaces/aplicativo-futebol**, que não está anexado a este executor. Branch local develop; cópia reconstruída com arquivos staged/modificados/untracked e sem checkout Git convencional. Nenhuma alteração local descartada. Lockfile local tem Git SHA c72cd8d0b835445b15380f4116a9a21bd18134a5, igual ao remoto; @supabase/ssr@0.12.7 instalado. Não é possível certificar os secrets ou estado do Codespaces a partir deste ambiente.

Precheck exato com --env-file=work/stage0032.test.env executado. Ausentes: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL e TEST_USER_B_PASSWORD. As outras três variáveis estão presentes. Inspeção de readiness confirmou zero secrets/runtime variables configurados no executor. Nenhum valor de credencial foi impresso. Suíte JWT real interrompida antes de autenticação e mutações. Sem novo teste HTTP ao Supabase: política continua sem autorização para esse host; tentativa anterior CONNECT 403 documentada acima. Não contornar o proxy; executar os comandos no terminal do Codespaces com as nove variáveis presentes.

### Auditoria de dependências somente leitura

Executado npm audit --omit=dev --audit-level=moderate --json: exit 0, **zero achados**. Auditoria completa adicional reproduziu **11 pacotes sinalizados: 1 moderado, 9 altos, 1 crítico**, exit 1. Registro consultado: https://registry.npmjs.org/. Os onze são devDependencies diretas/transitivas no lockfile; não são onze falhas independentes. Relatórios brutos permanecem em work/ ignorado. Nenhuma versão, package.json ou lockfile alterado.

| Dependência instalada           | Severidade npm | Caminho/alcance                                                                                                          | Correção disponível observada                                                                        |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| tar 7.5.11                      | Crítica        | Transitiva do CLI Supabase; parsing/descompressão de arquivos, ferramenta/instalação, fora da árvore runtime de produção | tar 7.5.22 disponível, acima das faixas afetadas publicadas; npm propõe supabase 2.121.0             |
| supabase 2.81.3                 | Moderada       | CLI de desenvolvimento; herda tar, não o SDK usado no app                                                                | npm indica 2.121.0; metadados dessa versão não listam tar como dependência direta                    |
| braces 3.0.3                    | Alta           | Stack exhaustion por padrões profundamente aninhados; ferramentas de glob                                                | Latest 3.0.3 ainda afetada; nenhuma versão corrigida publicada identificada                          |
| micromatch 4.0.8                | Alta           | Propagação de braces, dev                                                                                                | Sem versão corrigida certificada enquanto a cadeia afetada persistir                                 |
| fast-glob 3.3.1/3.3.3           | Alta           | Propagação de micromatch, lint/geradores                                                                                 | Sem correção segura certificada; npm sugere downgrade do pai shadcn                                  |
| @next/eslint-plugin-next 16.4.2 | Alta           | Propagação de fast-glob, lint                                                                                            | npm sugere eslint-config-next 14.2.35, downgrade incompatível a avaliar; não aplicar automaticamente |
| eslint-config-next 16.4.2       | Alta           | Dependência direta de lint                                                                                               | Mesma sugestão 14.2.35; nenhuma atualização compatível corrigida certificada                         |
| @shadcn/registry 0.2.0          | Alta           | Propagação de fast-glob, gerador                                                                                         | npm sugere downgrade de shadcn para 1.0.0; não tratado como correção aprovada                        |
| shadcn 4.22.1                   | Alta           | CLI/gerador de componentes, não componentes locais em runtime                                                            | npm sugere 1.0.0, downgrade; precisa revisão antes de qualquer mudança                               |
| @ts-morph/common 0.27.0         | Alta           | Propagação de fast-glob, ferramentas                                                                                     | npm marca fixAvailable=true sem versão exata; versão corrigida não certificada                       |
| ts-morph 26.0.0                 | Alta           | Propagação de @ts-morph/common, ferramentas                                                                              | npm marca fixAvailable=true sem versão exata; versão corrigida não certificada                       |

Principais advisories: [braces DoS](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [tar descompressão/parse DoS](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [tar recursão](https://github.com/advisories/GHSA-r292-9mhp-454m). tar também acumula avisos de file smuggling, tipos PAX e loops/exceções. A classificação crítica é a reportada pelo npm; não demonstra execução remota no aplicativo. Nenhum caminho de upload/extração pelo app foi demonstrado nesta inspeção.

Zero achados em --omit=dev significa ausência de advisories conhecidos na árvore consultada, não certificação de segurança do app. DevDependencies podem executar em npm ci, postinstall, build e CI, portanto o risco operacional não deve ser ignorado. Nesta cópia local a instalação anterior omitiu scripts; isso não descreve a instalação executada pelo proprietário no Codespaces.

### Plano de correção proposto — não executado

1. Priorizar o CLI Supabase/tar: avaliar atualização fixa para supabase 2.121.0 em alteração isolada, revisar requisitos/instalador/CLI e resolver lockfile; confirmar ausência de tar vulnerável na árvore final. Se mantido o CLI atual, avaliar override tar 7.5.22 somente após compatibilidade com consumidor e testes, não aplicar às cegas.
2. Investigar a necessidade de manter o CLI shadcn instalado, considerando que componentes gerados são locais. Avaliar remoção da ferramenta ou atualização compatível quando a cadeia braces estiver corrigida; não fazer downgrade para shadcn 1.0.0 só para reduzir contagem.
3. Manter eslint-config-next compatível com Next 16; aguardar/avaliar correção upstream ou substituição compatível da cadeia de glob. Não forçar braces para versão inexistente nem regredir lint para Next 14.
4. Antes de aplicar, apresentar alteração exata de package.json/lockfile e compatibilidade. Após autorização, executar instalação limpa, audit completa/produção, lint, typecheck, unidades, SQL quando pertinente e build. Não usar npm audit fix --force.

Mudança desta tentativa exclusivamente documental. JWT real/Data API/RPC/SSR e interface privada permanecem pendentes. Execute a suíte no Codespaces conforme roteiro acima e registre somente saída sanitizada. Etapa 003.2 **não concluída**; nenhuma alteração em dados existentes, main, produção, DNS, Resend ou RLS.

## Retomada após correção da conta B — 21/10/2026

O proprietário informou execução anterior com login A bem-sucedido, login B recusado com invalid_credentials/HTTP 400 e interrupção antes de criar grupos/jogadores ou testar isolamento. Informou também que corrigiu a senha B. Esses resultados são relato do proprietário; não há nova execução JWT verificada nesta retomada.

Executor acessível: Codex /workspace, sem Codespaces /workspaces/aplicativo-futebol anexado, sem secrets/runtime variables configurados. --check executado no arquivo ignorado local: faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL e TEST_USER_B_PASSWORD; três demais campos presentes. Suíte real não iniciada; nenhum manifesto novo, fixture remota ou teste de isolamento produzido. Não atribuir FAIL de segurança a um teste não executado.

GitHub consultado: develop em c0413eee3907016cf593db02881043e92c064297 antes deste registro; PR #1 Draft. Busca de 3cd2f9a retornou No commit found for SHA (422). Não foi recriado módulo de diagnóstico nem feito push do commit ausente às cegas. Necessário verificar sua existência local no Codespaces e sincronizar sem force.

No terminal do Codespaces: conferir branch/status/log e git show --stat 3cd2f9a; se o commit existir na develop local, revisar git fetch origin e divergência antes de git push origin develop. Se houver divergência com os registros documentais remotos, preservar alterações e integrar com revisão; não resetar/forçar push. Confirmar que TEST_USER_B_PASSWORD foi atualizado no secret ou arquivo efetivamente carregado; se atualizado como secret, reiniciar o Codespaces. Variável exportada tem precedência sobre --env-file. Não imprimir valores. Executar --check e, somente com nove campos presentes/contas confirmadas, executar a suíte uma única vez. Em FAIL, guardar fase/run/manifesto e diagnóstico sanitizado, sem repetição automática.

Resultado desta retomada: zero cenários JWT aprovados, zero reprovados, suíte bloqueada antes de login; cenário anterior A PASS/B FAIL não foi reexecutado nem convertido em aprovação. Pendentes JWT distinto A/B, Data API/RPC/RLS, proteção SSR e integridade, além das demais verificações essenciais já listadas. 4ª Força e Grupo Teste 2 preservados. Etapa 003.2 não concluída.

## Autenticação

Revisados cadastro/confirmação, login/logout, recuperação/reset, callback PKCE, proxy, sessão SSR e rotas privadas. Mantidos getUser no servidor, destinos fixos, origem configurada e Cache-Control private/no-store. Nenhuma URL externa fornecida pelo usuário é aceita como destino. Confirmação de e-mail não foi desabilitada.

Endurecimento aplicado: cookies do SDK usam Secure explicitamente e de forma consistente nos clientes browser, servidor e proxy em build de produção/Preview ou origem HTTPS. Nomes, domínio host-only, path e SameSite do SDK permanecem iguais. HTTP localhost continua utilizável no desenvolvimento. Testes cobrem flags de sessão e code_verifier; não são uma troca real com GoTrue.

O proprietário confirmou manualmente cadastro, confirmação, login, dashboard, grupo/owner, convidado, bloqueio visual entre grupos e recuperação com nova senha e login posterior. O PKCE requer solicitar e abrir no mesmo navegador/origem; testes em navegadores diferentes não compartilham code_verifier. Não foi alterado o comportamento homologado. Reenvio, logout, perfil, refresh e reutilização de link ainda precisam de registro funcional nesta auditoria.

## Banco e Security Advisor

Inspeção remota somente leitura: dez tabelas public/private com RLS; nenhum grupo com contagem inválida de owner ativo; app_executor sem LOGIN, SUPERUSER ou BYPASSRLS; clientes sem CREATE public e sem privilégios nas tabelas privadas; nenhuma view public/private. Sete migrations confirmadas; a local 20261020161609_stage003_identity_workflows.sql corresponde à remota 20261020162554. Nenhuma migration ou permissão foi alterada.

| Achado                                    | Classificação e tratamento                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quatro WARN SECURITY DEFINER autenticados | Fronteira privilegiada intencional de risco moderado: ensure_my_identity, save_my_identity, create_group_once e add_guest_once; owner técnico restrito, search_path vazio, EXECUTE negado a anon, identidade e autorização verificadas. Aceitos provisoriamente com testes SQL; falta prova HTTP/JWT real. |
| Dois WARN rls_auto_enable                 | ACL ampla preexistente; higiene de privilégio moderada, sem exploração demonstrada. Retorna event_trigger, owner postgres e search_path pg_catalog. Não é uma RPC comum. Revisar com administrador antes de produção; não alterar função gerenciada sem justificativa/testes.                              |
| Um WARN de senhas vazadas                 | Proteção desabilitada; risco moderado de credenciais comprometidas. Habilitação depende de configuração administrativa/plano e não foi executada.                                                                                                                                                          |
| Três INFO RLS sem políticas               | Deny-by-default deliberado: private.membership_events, private.mutation_receipts e public.group_invitations. Não abrir acesso para silenciar o Advisor.                                                                                                                                                    |

Não foram flexibilizadas políticas. Autorização usa vínculo ativo/owner e não user_metadata. A ponte privada auth_user_id não concede acesso direto a auth.users aos clientes/executor.

## Testes executados

- Formatação, lint, typecheck, 74 testes em 11 arquivos e build Next.js passaram.
- PostgreSQL descartável: sete migrations, 70 asserções SQL, regressões da ponte e smoke Etapa 003 passaram. Papéis authenticated/anon não privilegiados com claims simuladas; não equivalem a JWT real.
- Seis corridas passaram: última vaga, convidado idempotente, transferência de owner, criação idempotente de grupo, disputa de slug e criação independente A/B. Verificados unicidade do owner, rollback e associações. Somente fixtures locais descartáveis.
- Chromium local: 32 verificações em 1440/390 px, claro/escuro, páginas públicas e estados de preparação; sem overflow horizontal, erro JS não tratado ou input sem label. Manifesto e quatro PNG responderam 200. Sem variáveis Supabase no build local; não representa dashboard/grupo/elenco autenticado.
- Novo runner scripts/test-stage0032-integration.mjs: sintaxe e --check passaram. Execução real não realizada: usuário confirmou ausência das duas contas fictícias configuradas. Nenhum JWT simulado foi apresentado como real.

## Executar a integração pendente

Configurar duas contas fictícias exclusivas, confirmadas, em secrets de um executor com rede. Não enviar senhas/tokens no chat. Usar tests/stage0032.env.example como referência e arquivo ignorado work/stage0032.test.env. Não requer service_role nem conexão administrativa.

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --check
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs
```

O runner autentica dois usuários distintos com JWT real, cria grupos/convidados sintéticos exclusivos, verifica isolamento na Data API/RPC e cookies SSR em /api/me e /groups/[slug], rejeita autoelevação e escrita cruzada. Não exclui linhas nem edita perfis existentes. Guarda manifesto privado em work/ para revisão de limpeza. Faz signOut apenas das sessões dedicadas do teste. --check verifica presença de configuração, não prova integração. Ainda será necessário navegador autenticado desktop/celular/claro/escuro e teste com membro autenticado comum, além dos owners A/B.

## Vercel e domínio

Na inspeção, www.borafute.com.br aponta por alias fixo para dpl_HaXCLVNWJ4iBDnm2NfcpfudNBrbM (Preview READY develop c36ddb1). Não acompanha automaticamente commits. Proteção all_except_custom_domains preservada. borafute.com.br mantém configuração de redirect 308 para www; requisição direta ao raiz limitada pelo proxy, sem confirmação HTTP nesta auditoria.

Associação automática oficial: editar Git Branch do domínio existente para develop em Settings → Domains, ou PATCH /v9/projects/prj_F4qeSw3UsqZzXj5cA89XSY5PgGnt/domains/www.borafute.com.br?teamId=team_ZCVh2SDJPkrBvec05vrO0RTO com body {"gitBranch":"develop"}. Ferramenta PATCH/CLI autenticada indisponível: não executado. Não remover/recriar domínio. Nenhuma alteração em DNS, Resend, main ou produção.

Manter Site URL de homologação https://www.borafute.com.br e allowlist exata dos callbacks /auth/callback e /auth/callback?flow=recovery, mais origens Preview/Codespaces efetivamente usadas. Template ConfirmationURL preserva verify → callback → PKCE. Configuração administrativa Auth/templates/SMTP não foi modificada nem certificada pelas ferramentas disponíveis.

## Limpeza — somente inventário, sem exclusão

- Candidato sujeito à confirmação do proprietário: Grupo Teste 2, slug grupo-teste-2, id f9285629-b4c5-40c3-af89-36878ef9915b; um vínculo e nenhum convidado observado. Dependências adicionais devem ser conferidas antes de um plano de exclusão.
- Preservar 4ª Força, id 1a1299b0-df76-4d62-8d92-3da06bc42e03, e todos seus dados.
- Jogador Teste, id 17060c87-d5d1-4fb0-adca-f65e506206fd, pertence ao 4ª Força: não é candidato automático à exclusão pelo nome.

Nenhuma exclusão executada. Qualquer limpeza exige autorização específica e revisão de dependências.

## Parecer

Base local estável, sem vulnerabilidade crítica conhecida demonstrada. **Não liberar a Etapa 003.2 nem considerar a Etapa 004 tecnicamente desbloqueada** antes de validar isolamento real JWT/Data API/RPC/SSR e interface privada autenticada. Resolver/revisar avisos administrativos antes de produção. Build e bloqueio visual não substituem esses critérios.
