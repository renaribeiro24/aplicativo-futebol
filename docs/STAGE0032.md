# Etapa 003.2 — auditoria de segurança e estabilização

Data: 21/10/2026. **Não concluída: a execução JWT real autenticou A/B e passou as verificações de identidade, isolamento e permissões, mas falhou na fase SSR.** A auditoria de dependências também reporta um alerta crítico em dependência de desenvolvimento. Isso não representa certificação de ausência de vulnerabilidades.

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
