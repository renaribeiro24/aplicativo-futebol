# Etapa 003.2 — auditoria de segurança e estabilização

Data: 21/10/2026. **Não concluída: testes essenciais com JWT real A/B pendentes.** Nenhuma vulnerabilidade crítica foi demonstrada pela revisão disponível; isso não representa certificação de ausência de vulnerabilidades.

## Nova tentativa de execução JWT — 21/10/2026

**Bloqueada; nenhum teste JWT real executado ou aprovado nesta tentativa.**

Inspecionados docs/STAGE0032.md, tests/stage0032.env.example e scripts/test-stage0032-integration.mjs. Executor gerenciado sem secrets, variáveis de runtime ou identidades externas configuradas; as quatro variáveis de contas A/B estão ausentes. Nenhum arquivo de credenciais foi lido ou publicado. Criado somente work/stage0032.test.env com placeholders, modo 0600 e exclusão pelo Git confirmada. Precheck executado exatamente:

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-integration.mjs --check
```

Resultado: faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e as quatro variáveis TEST_USER_A/B_EMAIL/PASSWORD. SITE_URL e os dois consentimentos do template estão presentes. Exit 0 de --check significa apenas que a inspeção terminou; não comprova configuração completa nem autenticação. A chamada completa não foi iniciada sem duas contas reais confirmadas.

Sondagem sem credenciais a /auth/v1/health: HTTP 000; execução normal não alcançou o proxy e a tentativa com acesso de rede do executor recebeu CONNECT 403. Política vigente não permite o host Supabase. Não foi tentado contornar o proxy. Nenhum usuário, grupo ou convidado remoto foi criado/alterado/excluído.

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

Não usar tee de tráfego, DEBUG de Auth, dumps de cookies ou impressão de variáveis. O runner já suprime detalhes do provedor. Guardar somente resultado PASS/FAIL, fase, identificador de execução e caminho do manifesto. Em falha, não repetir cegamente: revisar a fase e os registros desta execução.

### Evidência exigida para encerramento

Registrar commit do runner, implantação Preview efetivamente servida por www, data/hora, resultado e fase, run e manifesto privado work/stage0032-UUID.json. Não publicar JWTs, cookies, e-mails ou senhas. Confirmar explicitamente os resultados de login A/B, Data API, RPCs, escrita/acesso cruzado, owner/convidados, SSR e anonimato. O manifesto mantém IDs dos registros sintéticos para revisão, sem exclusão automática.

O runner cobre owners A/B e a rejeição de promover convidado por setter genérico; não representa um membro comum autenticado tentando promover a si próprio. Esse cenário e navegador privado autenticado desktop/celular/claro/escuro continuam necessários para o encerramento integral da etapa. Não chamar --check, mocks ou claims SQL de prova JWT real.

4ª Força, seus jogadores e Grupo Teste 2 devem permanecer intactos. A autorização desta tentativa não permite limpeza desses registros. Sem merge/main, produção, DNS, Resend ou mudanças de RLS. A suíte remota e os critérios críticos continuam pendentes até evidências reais.

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
