# Correção temporária do domínio BoraFute — 21/10/2026

## Estado atual

Operação autorizada pelo proprietário: servir o Preview de develop em https://www.borafute.com.br, sem produção. Somente o projeto aplicativo-futebol (`prj_F4qeSw3UsqZzXj5cA89XSY5PgGnt`) da equipe `team_ZCVh2SDJPkrBvec05vrO0RTO` foi alterado.

| Recurso              | Antes                                                                                                             | Depois                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| www.borafute.com.br  | Domínio verificado no projeto, gitBranch=null, sem produção ativa; consulta retornou 404 no lookup da implantação | Alias explícito para Preview READY de develop                                                              |
| borafute.com.br      | Verificado, redirect=www.borafute.com.br, redirectStatusCode=308                                                  | Cadastro preservado, sem alteração                                                                         |
| main                 | 3d0b7c3d6f53125b7cf5a218e2d0af07f9b4508c                                                                          | Sem merge/push ou deploy desta branch                                                                      |
| Proteção             | Vercel Authentication all_except_custom_domains                                                                   | Mantida; domínios personalizados já eram exceção                                                           |
| NEXT_PUBLIC_SITE_URL | Preview geral aponta ao alias vercel.app                                                                          | Override exclusivo Preview/develop para https://www.borafute.com.br; valores de outros escopos preservados |

Preview associado: `dpl_Fx22RJ7cBjY4cZv4SqjSCNzkptwC`, URL https://aplicativo-futebol-rkkplywjn-renan-ribeiros-projects.vercel.app. Fonte develop no commit `1390d491623ba0ab75632a55b7614ae8b1487358`, target=null (Preview), READY e aliasError=null. A compilação foi concluída em aproximadamente um minuto. Não há promoção, deploy de produção, alteração DNS, registrador, zonas, e-mail, chaves ou Supabase nesta operação.

A associação inicial ao Preview anterior removeu o erro de www; depois o domínio foi reassociado ao Preview novo, reconstruído com o override da origem. Nenhum domínio precisou ser removido, recriado ou adicionado novamente. Outros projetos e demais domínios deste projeto foram preservados.

## Mecanismo utilizado e limite importante

A documentação oficial disponibiliza PATCH /v9/projects/{idOrName}/domains/{domain} com gitBranch=develop para a associação permanente à branch. Porém a integração desta sessão não expõe essa operação, e não há CLI Vercel autenticada/credencial configurada no executor. Não houve tentativa destrutiva de remover/recriar o domínio.

Foi usada a operação oficial de alias POST /v2/deployments/{id}/aliases, equivalente a vercel alias set, atribuindo www diretamente ao Preview READY. **É uma associação temporária a uma implantação específica, não um vínculo automático à branch.** O cadastro do domínio continua gitBranch=null. Próximos pushes em develop podem atualizar o alias vercel.app sem atualizar www.

Para manutenção, usar o painel Vercel → projeto correto → Settings → Domains → editar www e associar à branch develop, ou a API PATCH oficial com corpo `{"gitBranch":"develop"}` na mesma equipe. Essa atualização não exige remover domínio/DNS. Se ficar indisponível, reassociar www manualmente ao novo Preview READY com a operação de alias, após conferir projeto, equipe, origem e target Preview. Nunca usar promote ou --prod para essa manutenção.

Quando houver futura autorização de produção, revisar a associação temporária e o override Preview/develop em uma operação separada; não presumir que um deploy main deve tomar esse alias sem revisão.

## Autenticação, SSR e PKCE

Código de actions e callback reconferido na branch remota. Cadastro/reenvio usam emailRedirectTo fixo; recuperação usa redirectTo fixo com flow=recovery; origem vem de getSiteOrigin(NEXT_PUBLIC_SITE_URL). Callback troca code via exchangeCodeForSession, com destinos dashboard/reset-password ou mensagens de erro e no-store. Nenhum código de runtime foi alterado e nenhum next externo foi introduzido.

O override de NEXT_PUBLIC_SITE_URL foi criado somente em Preview e gitBranch=develop, antes do novo build. URL/chave Supabase não foram alteradas nem impressas; as três variáveis constam nos escopos Preview/Production, sem alteração de Production.

Configuração necessária para revisão no Supabase (não alterada; o MCP disponível não expõe leitura/gestão de URL Configuration/templates/SMTP):

- Site URL desejada: https://www.borafute.com.br
- Redirect URL: https://www.borafute.com.br/auth/callback
- Redirect URL: https://www.borafute.com.br/auth/callback?flow=recovery

Preservar callbacks exatos ativos de desenvolvimento/Codespaces, sem curingas amplos. Manter confirmação de e-mail habilitada e templates com ConfirmationURL que preserve o redirect enviado pelo SDK. Não inventar /auth/confirm ou token_hash: o callback implementado recebe code.

**Iniciar e concluir os novos fluxos no www e no mesmo navegador.** Um link iniciado no alias vercel.app antes da mudança pode não encontrar seu verificador PKCE em www; solicitar novo link a partir de www. A mudança do hostname não transfere cookies. Nenhum cookie compartilhado de domínio foi configurado.

Vercel Authentication continua habilitada para URLs abrangidas por all_except_custom_domains. Pela regra já existente, www pode ser aberto sem login Vercel; a sessão da aplicação e RLS continuam obrigatórias. Essa exposição decorre da associação de um domínio personalizado à configuração existente, não de desativação da proteção. Nenhuma configuração de proteção foi ampliada/desabilitada. As verificações HTTP usaram a integração Vercel autenticada; não provam por si sós uma navegação anônima completa.

## Verificação HTTPS e limites

Após a associação, a integração autenticada recebeu conteúdo real em www, home e /login, /signup, /forgot-password: HTTP 200, sem DEPLOYMENT_NOT_FOUND. Telas de autenticação responderam com Cache-Control private/no-store. A marca visual ainda é Em Campo, conforme o código atual; não foi feito rebranding.

Callbacks sem code válido também foram consultados: /auth/callback levou ao login e /auth/callback?flow=recovery à recuperação, ambos com mensagem de erro e no-store. A ferramenta segue redirects; o 200 final não é o status original do redirect. Isso não testa confirmação/recuperação reais.

O domínio raiz mantém redirect=www e status 308 no cadastro. **O 308 em tráfego HTTPS não foi validado neste executor.** O web_fetch da integração falhou em lookup_deployment para o domínio somente de redirect, antes de obter resposta do site; esse 404 da ferramenta não é prova de um 404 HTTP do domínio. O curl via proxy foi bloqueado em CONNECT com 403. Não contornar a política de rede. Conferir no navegador/rede autorizada que https://borafute.com.br retorna 308 com Location para www, incluindo preservação de caminhos/query.

Confirmação/recuperação com e-mails reais, cookies PKCE e sessão autenticada continuam pendentes; nenhum cadastro, senha ou dado de jogador foi usado neste ensaio. Retestes devem começar no www com contas fictícias controladas. Etapa 003 não homologada por esta correção de domínio.

Somente documentação de implantação foi alterada no GitHub. O commit documental pode disparar outro Preview pelo Git, mas www permanece fixado à implantação acima até uma nova operação de alias/branch. Testes locais de aplicação não foram repetidos porque não houve alteração de código; o build Vercel e os testes HTTPS são as evidências desta tarefa.

Referências: [Update a project domain](https://vercel.com/docs/rest-api/projects/update-a-project-domain), [Alias CLI](https://vercel.com/docs/cli/alias), [Deployment Protection](https://vercel.com/docs/deployment-protection).

---

# Histórico de implantação anterior

# Etapa 003.1 — Preview implantado; homologação funcional pendente

Execução em 20/10/2026. Este registro substitui o bloqueio anterior de autorização da equipe: a conexão autenticada agora conseguiu listar e criar o projeto.

## Projeto e implantação

- Projeto exclusivo: aplicativo-futebol; ID `prj_F4qeSw3UsqZzXj5cA89XSY5PgGnt`.
- Equipe: renan-ribeiros-projects (`team_ZCVh2SDJPkrBvec05vrO0RTO`).
- GitHub: renaribeiro24/aplicativo-futebol; produção vinculada a main; Preview executado de develop. PR #1 continua em rascunho, sem merge.
- Raiz: repositório; framework Next.js; Node 24.x; instalação `npm ci`; build `npm run build` (`next build --webpack`).
- Alias estável de develop: https://aplicativo-futebol-git-develop-renan-ribeiros-projects.vercel.app.
- Deployment Preview validado: `dpl_3YCNKLneVfmhTBPNc6vVXLKgjeda`; URL única: https://aplicativo-futebol-7p8jyu8it-renan-ribeiros-projects.vercel.app.
- Commit de código: `a6fb0b44fd24e8fc469c913b116a8e93465baf1c`. Estado READY, aliasError=null. Construção e disponibilização em aproximadamente 62 segundos.
- Nenhuma operação foi dirigida aos projetos futebol-app ou futebol-app-3xl7.

Incidente da integração: a primeira chamada explícita com target=preview retornou target=production. Foi cancelada imediatamente e o estado CANCELED foi confirmado (`dpl_4b8a4NJJngWizD8Qey4mowteUWRG`); não foi concluída nem promovida. A documentação atual do MCP orienta **omitir target para Preview**. A chamada corrigida produziu target=null e somente alias da branch develop. Não há liberação de produção nesta etapa.

## Variáveis e proteção

As três variáveis foram configuradas como encrypted, exclusivamente em target preview, e reconferidas sem descriptografar valores:

| Variável                             | Estado                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL             | Projeto de desenvolvimento hpbvtqvbtyioqjyelrpb                        |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Chave moderna publishable ativa obtida do projeto; valor não publicado |
| NEXT_PUBLIC_SITE_URL                 | Origem HTTPS do alias estável de develop acima                         |

Nenhuma service_role, secret key, senha ou token administrativo foi configurado. NEXT_PUBLIC é incorporado ao cliente; encrypted protege o armazenamento na Vercel, não torna uma variável pública secreta. Production e Development não receberam essas variáveis.

Vercel Authentication permaneceu habilitada em all_except_custom_domains. Nenhum domínio personalizado ou regra ampla de bypass foi criado. As leituras HTTP de verificação usaram a integração autenticada disponível. Testadores precisam de acesso à proteção Vercel antes de iniciar o fluxo. Ainda é necessário verificar no navegador se o retorno de e-mail preserva query, cookies e PKCE ao atravessar a proteção; não remover a proteção global para contornar falhas.

## Supabase Auth — configuração necessária, ainda não aplicada

A integração Supabase disponível permite banco/advisors, mas não oferece gestão de configuração Auth/SMTP. Não foi possível inspecionar ou alterar Site URL, allowlist, confirmação, templates ou SMTP atuais.

Em https://supabase.com/dashboard/project/hpbvtqvbtyioqjyelrpb/auth/url-configuration:

- Site URL: https://aplicativo-futebol-git-develop-renan-ribeiros-projects.vercel.app
- Redirect URL: https://aplicativo-futebol-git-develop-renan-ribeiros-projects.vercel.app/auth/callback
- Redirect URL: https://aplicativo-futebol-git-develop-renan-ribeiros-projects.vercel.app/auth/callback?flow=recovery

Permitir somente essas URLs exatas e os callbacks exatos dos Codespaces efetivamente usados, sem wildcard geral. Manter confirmação de e-mail habilitada. No painel de e-mail, conferir templates de confirmação/reenvio e recuperação, preservando o destino enviado pelo SDK via ConfirmationURL/RedirectTo.

Site URL é global ao projeto. Estratégia escolhida: Preview como origem padrão de homologação; Codespaces usa NEXT_PUBLIC_SITE_URL da própria origem HTTPS e callbacks exatos adicionais. Templates fixados em SiteURL podem mandar Codespaces para Preview e perder o verificador PKCE. Começar e terminar cada fluxo no mesmo navegador e na mesma origem. A URL única do deploy não deve ser usada para iniciar cadastro se o retorno aponta ao alias estável.

Inspeção do código confirmou: emailRedirectTo explícito para cadastro/reenvio; redirectTo com flow=recovery para recuperação; exchangeCodeForSession no callback; destinos fixos dashboard/reset-password; origem validada sem caminho/query/credenciais; getUser no servidor; clientes SSR por requisição; proxy preserva cookies de refresh e no-store. Não houve alteração dessas funcionalidades.

## SMTP e contas fictícias

Estado atual do SMTP e entrega de mensagens: **não verificado**. Cadastro, reenvio e recuperação usam os métodos reais do SDK, mas a entrega não foi comprovada. O SMTP padrão Supabase restringe destinatários aos membros autorizados da organização e tem limites baixos; não presumir que atende testadores externos.

Se necessário, configurar serviço externo compatível, como Resend ou Amazon SES, em https://supabase.com/dashboard/project/hpbvtqvbtyioqjyelrpb/auth/smtp. Campos: host, porta, usuário, senha SMTP, e-mail e nome do remetente; domínio remetente verificado e SPF/DKIM/DMARC conforme o provedor. Desabilitar rastreamento de links que altere os URLs de Auth. Não inventar credenciais nem publicá-las. Não foi contratado/configurado serviço nesta execução.

São necessárias duas caixas controladas de usuários fictícios, com recebimento real. Não usar dados do 4ª Força. Credenciais devem ficar em secrets do Codespaces, nunca em commits ou chat.

## Verificação e disponibilidade

Build e HTTPS foram comprovados; detalhes em VERIFICATION.md. Home e formulários públicos respondem com conteúdo real. API sem sessão recusa acesso, e dashboard sem sessão leva ao login.

**Implantação concluída; homologação permanece pendente.** Cadastro/recebimento/confirmação, login autenticado, dashboard privado, grupo/owner, convidado/elenco, perfil, logout, recuperação e isolamento A/B ainda precisam ser executados pelo roteiro STAGE003.md. Também permanecem pendentes celular/desktop/escuro no Preview e interação da proteção com callbacks reais. Não declarar disponibilidade funcional para testadores externos até concluir configuração de Auth/SMTP e essa jornada.

O executor local não conseguiu conectar ao proxy ao clonar o repositório. A execução remota pela Vercel e a documentação via GitHub autenticado evitaram esse bloqueio sem alterar rede/segurança. Testes locais não foram reexecutados nesta alteração documental. Não foram aplicadas migrations nem criados registros de jogadores.

## Auditoria de segurança

Advisor reconfirmado: seis WARN e três INFO.

| Achado                                                 | Classificação e decisão                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quatro RPCs autenticadas SECURITY DEFINER da Etapa 003 | Risco moderado inerente ao privilégio; fronteira intencional. Catálogo confirmou owner app_executor, search_path vazio, EXECUTE somente owner/authenticated, auth_user_id explícito e delegação fixa. app_executor sem LOGIN, SUPERUSER ou BYPASSRLS. Não há evidência crítica nesses wrappers; testes JWT reais de autorização ainda pendentes.                                                                                                                                    |
| Dois WARN de rls_auto_enable para anon/authenticated   | Higiene de privilégio pendente; potencial impacto alto do owner postgres, mas função retorna event_trigger e é ligada ao evento ensure_rls, não uma RPC normal de domínio. Corpo usa pg_event_trigger_ddl_commands e identificadores escapados; search_path pg_catalog. Não foi demonstrada exploração crítica. Avaliar revogação de EXECUTE de PUBLIC/anon/authenticated em mudança dedicada, com teste de criação de tabela/event trigger e Data API. Nenhum grant alterado aqui. |
| Três INFO de RLS sem policy                            | Baixo risco de exposição por este achado: membership_events, mutation_receipts e group_invitations deliberadamente fechadas. Não adicionar policies permissivas.                                                                                                                                                                                                                                                                                                                    |

Referências de remediação: [RPC autenticada](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RPC anônima](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Retenção/PII e revisão final permanecem anteriores à produção.

Documentação atual consultada via integrações: [MCP deployments](https://vercel.com/docs/agent-resources/vercel-mcp/tools/deployments), [Deployment Protection](https://vercel.com/docs/deployment-protection), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls). O changelog markdown não pôde ser obtido pelo executor sem conectividade; nenhuma funcionalidade Supabase nova foi implementada.

---

# Estado atual — Etapa 003 (20/10/2026)

Implementação de autenticação, dashboard, grupos, convidados e perfil entregue no código; homologação ponta a ponta pendente. Somente o desenvolvimento hpbvtqvbtyioqjyelrpb foi alterado. A sétima migration, 20261020161609_stage003_identity_workflows.sql, foi aplicada oficialmente como 20261020162554. O SQL registrado e o arquivo local coincidem por MD5 982403d7f8908a2ec8213735c7d3f93f; SHA-256/mapeamento em supabase/development-migrations.json. As seis anteriores foram preservadas. Nenhum deploy ou merge em main.

Nova tabela privada mutation_receipts e quatro novas APIs públicas para identidade própria atômica e operações idempotentes de grupo/convidado. Os novos auxiliares privados não têm EXECUTE para authenticated/anon, e a tabela não tem grants de cliente. Novas APIs são SECURITY DEFINER de app_executor com identidade explícita e escopo restrito; não utilizam postgres/service role para autorizar usuários. CREATE público temporário foi revogado no final da migration; nenhum grant em auth foi alterado. Tipos oficiais foram regenerados do remoto. Detalhes e justificativa em STAGE003.md/ADR-031.

A primeira aplicação foi rejeitada pela revisão automática por novos grants privados; foi revista sem contornar a rejeição. A tentativa revisada falhou por CREATE necessário para transferir owner; inspeção confirmou rollback (seis migrations e ausência de objetos novos). O ajuste transacional de grant/revoke foi validado localmente e então aplicado com sucesso. Não houve repetição cega, alteração parcial remota nem reparo de histórico.

Smoke SQL remoto stage003.sql passou: identidade repetível sem sobrescrever nome, grupo com owner único, slug duplicado rejeitado, convidado/posição com retries, edição própria atômica, isolamento e bloqueio administrativo/anônimo. Fixtures inteiramente revertidas; consultas confirmaram zero perfis, grupos e recibos após teste. Esses testes usam SET LOCAL ROLE/claims, não JWTs reais. O script de Auth/Data API real para Codespaces está em scripts/test-stage003-integration.mjs, com configuração fictícia em tests/integration.env.example e limpeza estritamente delimitada.

Advisor de segurança: seis WARN, sendo os dois preexistentes de rls_auto_enable e quatro de SECURITY DEFINER autenticado nas novas APIs intencionais, revisadas e explicitamente autenticadas. Três INFO de tabelas deliberadamente fechadas: convites, auditoria e recibos. Não criar policies abertas para eliminar esses INFO. Roteiro de revisão/homologação em STAGE003.md. Recibos/PII e retenção devem ser definidos antes de produção.

A configuração publicável local continua ignorada. A tentativa HTTPS real ao health retornou CONNECT 403 e HTTP 000 no executor Codex. Não se aplica ao Codespaces do usuário, que já demonstrou conectividade. Precheck sem revelar valores confirmou URL/publishable presentes, mas sem contas fictícias A/B, conexão privilegiada de limpeza ou psql neste executor. Não executar o script de integração sem esses pré-requisitos; --check não demonstra Auth aprovado.

---

# Histórico anterior

# Estado atual — Etapa 002.3, 20/10/2026

A correção autorizada foi aplicada exclusivamente em hpbvtqvbtyioqjyelrpb: arquivo supabase/migrations/20261020160133_auth_schema_bridge.sql, versão MCP 20261020160511, nome remoto 20261020160133_auth_schema_bridge. Histórico confirmado com seis migrations; nenhuma das cinco anteriores reaplicada ou editada. SQL completo do sexto registro comparado ao arquivo local por MD5: a8f7645946a007e0ec32ad1cb0ca5565. SHA-256 e correspondência de versões em supabase/development-migrations.json.

A bridge private.auth_user_id() é a única função privada que chama auth.uid(). Sem argumentos, retorna somente UUID da sessão, não consulta tabelas, é STABLE SECURITY DEFINER com search_path vazio. Owner postgres; ACL final {postgres=X/postgres,app_executor=X/postgres}. Sem EXECUTE de PUBLIC/anon/authenticated/service_role. O acesso indireto ocorre nas implementações autorizadas existentes, com a identidade do request preservada; não permite selecionar identidade de outra conta. A ponte não oferece operações de tabela nem SQL dinâmico. Clientes não podem assumir app_executor ou alterar o helper.

As sete funções foram substituídas por definições explícitas, mantendo owner app_executor, definer, assinaturas, volatilidade, search_path e ACLs. current_player_id, group_role e can_read_player continuam STABLE; audit_membership, create_group_impl, add_guest_impl e create_invitation_impl continuam VOLATILE. As seis funções anteriormente executáveis por authenticated preservam esse grant, com verificações de identidade/grupo; audit_membership continua restrita ao executor. Wrappers públicos continuam invoker. app_executor continua sem USAGE em auth e sem SELECT em auth.users; nenhuma permissão nesse schema foi concedida.

A migration usa um único DO com DDL estático para atomicidade, pré/pós-condições de estado e recusa de reaplicação. Localmente, erro injetado após criação/substituição reverteu todo o DDL; a aplicação real subsequente validou os corpos e privilégios originais restaurados. O arquivo da antiga proposta foi convertido em referência à implementação definitiva; sua substituição dinâmica não foi usada.

Testes locais passaram: seis migrations, 70 asserções, regressões de identidade/null/ACL, smoke de domínio e dois testes concorrentes; executor sem USAGE em auth. Lint, typecheck, 27 testes unitários, build e formatação passaram. Nenhuma imagem da pilha oficial Supabase completa foi iniciada nesta etapa; seu bloqueio anterior de registro está no histórico abaixo.

Pelo MCP remoto passaram development-smoke.sql e auth-bridge.sql: criação de grupo/convidado/convite por current_user authenticated com claims sintéticas, isolamento A/B, proteção de papel/proprietário, convites, locais entre grupos, elegibilidade/duplicidade de presença, transferência atômica, rejeição anônima e de execução direta da bridge. Dados aleatórios permaneceram em transações revertidas. Consulta posterior confirmou zero linhas nas oito tabelas e na auditoria. Isso é teste SQL de papéis/claims, não autenticação HTTP ou JWT real. O primeiro ensaio remoto do teste auxiliar foi recusado por SET SESSION AUTHORIZATION, indisponível ao postgres gerenciado; a versão portátil usa SET LOCAL ROLE e passou. O ensaio local security.sql continua com sessão não privilegiada.

Advisor de segurança após a sexta migration: mesmos dois WARN de ACLs na função preexistente public.rls_auto_enable e dois INFO de RLS sem policies nas tabelas intencionalmente inacessíveis. Nenhum aviso novo da bridge. Esses WARN não foram corrigidos porque alterações nessa função não fazem parte da autorização. Revisar suas ACLs antes de homologação, sem abrir políticas de dados. HTTP/Auth/JWT real continua dependente de execução no Codespaces ou de HTTPS permitido no executor Codex, com contas fictícias confirmadas ou credencial de provisionamento segura; não classificado como aprovado.

O bloqueio SQL para iniciar a Etapa 003 foi resolvido. Telas de cadastro de perfil/grupo e dashboard funcional ainda são trabalho da próxima etapa. Não declarar Auth end-to-end homologado antes dos testes HTTP. Não houve merge, deploy, dado real ou alteração de outro projeto. PR #1 permanece rascunho.

---

# Histórico das etapas anteriores (estado anterior à correção)

# Implantação de desenvolvimento — 20/10/2026

## Resultado atual

Projeto exclusivo: **plataforma-futebol**, ref `hpbvtqvbtyioqjyelrpb`, PostgreSQL 17.11. As cinco migrations autorizadas foram aplicadas em ordem via `Supabase MCP apply_migration`, com sucesso individual e histórico oficial. Antes da escrita: projeto ACTIVE_HEALTHY, nenhuma tabela em public/private, nenhum histórico de migrations, nenhum schema private/papel app_executor ou RPC conflitante. Existia uma função de infraestrutura `public.rls_auto_enable()` que não foi substituída.

As oito tabelas públicas e private.membership_events existem com RLS; 63 constraints, 31 índices e oito wrappers administrativos foram conferidos no catálogo. Nenhuma tabela de aplicação concede acesso anônimo. Wrappers públicos da aplicação são SECURITY INVOKER; funções privadas têm search_path vazio e ACLs restritas. app_executor não tem login/superuser/BYPASSRLS ou vínculo com papéis de cliente.

**A integração de banco ainda não está pronta:** o smoke SQL remoto falhou em create_group com `42501: permission denied for schema auth`. O papel postgres gerenciado não possui grant option no schema auth: a primeira migration concluiu, mas o grant de USAGE para app_executor não ficou efetivo. Não repetir as migrations: o histórico e os objetos já estão confirmados. A transação de teste foi abortada; consultas posteriores confirmaram zero registros nas oito tabelas.

Uma proposta incremental está em `docs/proposals/auth-schema-bridge.sql`, fora da pasta de migrations e **não aplicada**. Ela cria um helper privado, de proprietário postgres, que retorna somente auth.uid() do chamador e permite EXECUTE apenas a app_executor; sete implementações passam a usá-lo. Isso mantém o uso do helper oficial sem conceder leitura de auth.users ou associar papéis de cliente ao executor. Os 70 testes SQL e dois testes de concorrência passaram localmente com a proposta. A aprovação adicional foi solicitada porque a autorização original cobre somente cinco migrations. Depois da aprovação: criar nova migration pelo CLI, testar na pilha oficial quando acessível, aplicar via mecanismo oficial e repetir smoke/advisors/tipos. Não editar as cinco migrations aplicadas.

## Histórico e rastreabilidade

| Arquivo original                       | Versão remota atribuída pelo MCP |
| -------------------------------------- | -------------------------------- |
| 20261019205218_identity_tenants.sql    | 20261020150243                   |
| 20261019205219_members_scheduling.sql  | 20261020150255                   |
| 20261019205220_security_invariants.sql | 20261020150307                   |
| 20261019205221_administration.sql      | 20261020150320                   |
| 20261019205222_access_policies.sql     | 20261020150339                   |

Os nomes remotos contêm o timestamp e nome originais. `supabase/development-migrations.json` registra também SHA-256 dos arquivos. MD5 do SQL completo foi comparado com statements[1] do histórico remoto: cinco correspondências exatas. Nenhuma migration anterior foi apagada, reparada ou reaplicada.

**Não usar db push diretamente com estes nomes locais neste projeto:** o CLI compararia versões diferentes e tentaria reaplicar ou exigiria reparo. Para esta implantação, continuar pelo MCP após consultar o histórico e verificar o mapeamento. Para migrar futuramente ao CLI, planejar separadamente a reconciliação dos nomes locais com as versões existentes, preservando os arquivos originais e sem remover registros do histórico. `migration repair` não deve ser usado automaticamente. Um novo ambiente vazio pode aplicar os cinco arquivos originais em ordem, após a correção incremental aprovada e suas verificações.

## Advisors e limites de segurança

- Segurança: dois INFO de RLS sem policy em group_invitations e private.membership_events. São bloqueios intencionais; não adicionar policy permissiva para eliminar avisos.
- Segurança: dois WARN para EXECUTE de anon/authenticated na função preexistente public.rls_auto_enable(). Sua definição é de event trigger com search_path=pg_catalog; não é uma RPC comum de aplicação, mas suas ACLs foram sinalizadas. Proposta de correção futura: migration incremental que revogue EXECUTE de PUBLIC, anon e authenticated nessa função, preservando o event trigger. Não alterada além das cinco migrations autorizadas.
- Desempenho: 13 INFO de índices ainda sem uso, esperados em banco novo sem dados. Nenhum índice removido.
- Confirmados grants/RLS por catálogo. Não foi possível validar schemas expostos via PostgREST por HTTP: rede bloqueou a API do projeto com CONNECT 403. A configuração local expõe apenas public. Conferir também a configuração remota da Data API antes de homologar.
- Auth/API com JWT real não testados: sem credencial administrativa disponibilizada e sem conectividade HTTP ao projeto. Não criar usuários diretamente em auth.users como substituto do fluxo Auth real. O smoke SQL usa fixtures transacionais e claims locais explicitamente identificados, sem JWT real.
- Retenção/anonimização, aceitação de convite, reivindicação de convidados, Storage, SMTP e callbacks reais continuam pendentes. Nenhum bucket, dado real, deploy Vercel ou merge em main foi realizado.

## Configuração e execução

URL e chave publicável moderna foram obtidas pelo MCP e gravadas apenas em `.env.local` ignorado, com permissão 0600. Nenhuma service role/secret foi configurada. .env.example contém apenas nomes e campos vazios. Em outro checkout, copiar .env.example para .env.local e preencher pelo gerenciador de segredos do ambiente.

```sh
npm ci
npm run dev
```

Neste ambiente com proxy, o instalador oficial do CLI exige `npm_config_https_proxy="$HTTPS_PROXY" npm ci --no-audit --no-fund`. O npm ci inicial falhou por DNS do download do CLI; o comando com proxy suportado concluiu, mantendo TLS e checksum oficiais.

## GitHub e preservação

Remoto inspecionado: main em 3d0b7c3d6f53125b7cf5a218e2d0af07f9b4508c, somente README/.gitignore; fetch e ls-remote confirmaram ausência de develop e de alterações adicionais. develop criada a partir do mesmo commit, sem reset/force push. Todos os fontes das Etapas 001/002 foram preservados; apenas clientes receberam Database oficial e o runner SQL passou a aguardar o processo final do PostgreSQL, evitando confundir o servidor temporário de inicialização com o definitivo.

Excluídos intencionalmente: work/ (inclui credenciais e cópias anteriores), .env.local e outros ambientes, node_modules, .next, caches, next-env.d.ts gerado, logs e artefatos de testes. Ícones PNG, lockfile, frontend, PWA, testes, documentação, scripts, migrations e devcontainer fazem parte do código a publicar. Nenhum segredo foi encontrado na varredura por padrões nos fontes e no histórico inicial; isso não é garantia universal de detecção. Push de develop confirmado no commit b25c2e01efd71dcd2b07d1acfd1aebc73c347254. Uma clonagem bare nova do GitHub confirmou os 88 arquivos byte a byte, a presença de todos os 83 arquivos originais e main intacta no commit inicial. PR rascunho: https://github.com/renaribeiro24/aplicativo-futebol/pull/1. O relatório de verificação é registrado em commit posterior na mesma branch; nenhum merge foi realizado.

## Reinspeção de pendências — 20/10/2026

Reconsulta MCP somente leitura confirmou as mesmas cinco versões, oito tabelas públicas e auditoria privada com RLS, 63 constraints, 31 índices e oito RPCs de aplicação. Nenhuma migration foi reaplicada. private.auth_user_id() continua ausente.

Causa confirmada no catálogo: auth pertence a supabase_admin; postgres tem USAGE, mas não USAGE WITH GRANT OPTION. app_executor já tem EXECUTE em auth.uid(), porém não USAGE no schema. A função create_group_impl falha ao inicializar v_user; outras seis funções privadas também dependem de auth.uid(): current_player_id, group_role, can_read_player, audit_membership, add_guest_impl e create_invitation_impl.

USAGE permite resolver objetos do schema; não concede SELECT nas tabelas. Alternativa direta: um administrador com grant option conceder apenas USAGE a app_executor, mantendo EXECUTE somente no helper necessário e sem SELECT em auth.users. Essa alternativa evita novo SECURITY DEFINER, mas não pode ser executada pela identidade postgres disponível. A proposta auth-schema-bridge.sql mantém o helper oficial e restringe o novo EXECUTE ao executor; seu proprietário postgres é privilegiado, razão para manter corpo estático, sem argumentos/SQL dinâmico e search_path vazio. A função nova não consulta tabelas: retorna somente o UUID da sessão. Não transfere as outras funções para postgres, não concede login/membership/SELECT e não altera RLS. Copiar a leitura de claims evitaria o definer, mas duplicaria o contrato do Auth; conceder papéis administrativos ou mover todas as implementações para postgres ampliaria privilégios e não é recomendado.

GitHub reconsultado: develop em ccdf8c15d43c010dbb7e3945d1fc3b25d925952e, 88 arquivos e árvore idêntica ao checkout; todos os 83 arquivos da auditoria inicial presentes. Inclui cinco SQLs, 14 arquivos de src/app, dez de tests, sete de docs, devcontainer e cinco assets públicos. main segue em 3d0b7c3d6f53125b7cf5a218e2d0af07f9b4508c. Esta nota é a única atualização posterior dessa reinspeção.

Advisors de segurança reexecutados: dois WARN de EXECUTE na função preexistente rls_auto_enable e dois INFO de tabelas deliberadamente fechadas persistem. Não houve mudança de schema nem aplicação da proposta. Testes SQL/Next anteriores continuam evidências históricas, sem nova execução nesta reinspeção. HTTP/JWT reais permanecem bloqueados no executor Codex; a conectividade relatada pelo usuário no Codespaces é de outro ambiente e não foi classificada como teste aprovado deste executor. Nenhuma alteração de proxy foi tentada.

Arquivo completo proposto para revisão: docs/proposals/auth-schema-bridge.sql. O nome versionado com timestamp será criado pelo CLI somente após aprovação expressa. Aplicação permanece proibida até essa aprovação. Após aplicar uma correção aprovada: repetir smoke SQL transacional, conferir ACLs/RLS/advisors, executar testes Auth/API com JWTs reais em ambiente com rede e atualizar a verificação.
