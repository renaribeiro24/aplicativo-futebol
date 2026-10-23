# Auditoria de segurança — 21/10/2026

**Etapa 003.2 não concluída.** Relatório atual em [STAGE0032.md](STAGE0032.md): cookies Secure endurecidos, 74 testes unitários, SQL/RLS local e seis corridas passaram; 32 verificações públicas/preparação no Chromium. Isolamento JWT real A/B e interface privada autenticada pendentes por ausência de contas fictícias configuradas. Homologação funcional prévia informada pelo proprietário está registrada separadamente. Nenhuma migration, exclusão remota, DNS, Resend ou produção alterada. O alias www continua exigindo atenção a cada novo Preview; procedimento oficial de associação à develop no relatório. Registros abaixo são históricos.

---

# Etapa 003 — implementação entregue, homologação pendente

## Jornada e rotas

Cadastro com nome/e-mail/senha → confirmação real do Supabase, quando exigida → login → dashboard → criação de grupo → lista e cadastro de convidados. A implementação persiste no projeto de desenvolvimento existente; nenhum mock é usado no produto.

| Rota             | Acesso e comportamento                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| /                | Página pública esportiva, sem marca fixa de tenant                                                                    |
| /signup          | Cadastro real; nome de apresentação em metadata, sem conceder privilégios                                             |
| /confirm-email   | Reenvio de confirmação, resposta genérica e callback fixo                                                             |
| /login           | E-mail/senha, mensagens seguras, link de recuperação                                                                  |
| /forgot-password | Solicitação de recuperação PKCE com destino fixo                                                                      |
| /auth/callback   | Troca code por sessão; dashboard ou reset-password; link inválido/expirado recebe caminho de recuperação              |
| /reset-password  | Nova senha e confirmação; atualização exige usuário verificado no servidor                                            |
| /dashboard       | Saudação própria, até 100 grupos ativos mais recentes, papéis, estado vazio e atalhos                                 |
| /groups/new      | Nome, slug sugerido/editável, descrição e fuso IANA; criação por RPC atômica                                          |
| /groups/[slug]   | Grupo autorizado por RLS + vínculo; quantidade ativa, elenco paginado em 20 itens, papéis e formulário administrativo |
| /profile         | Nome privado de exibição, nome esportivo global, apelido e posição próprios                                           |
| /api/me          | Mantém identidade verificada e resposta sem cache; sem sessão retorna 401                                             |

Logout é Server Action; revalida a sessão via SDK, invalida cookies e retorna ao login. Falha de logout não finge sucesso. Rotas privadas usam Server Components, getUser, JWT do usuário via SSR e RLS. O slug não concede autorização: grupo invisível/sem vínculo retorna 404 sem distinguir existência. Erros inesperados usam a fronteira existente e repetição; carregamento usa skeleton existente.

## Identidade, falhas parciais e repetição

ensure_my_identity cria profile e player global em uma transação, com auth_user_id() como fonte de identidade e unicidade já existente. ON CONFLICT DO NOTHING recupera registros concorrentes sem sobrescrever nomes editados. Identidade arquivada não é reclamada nem reativada automaticamente. Nome inicial vem do campo de apresentação da conta, validado e limitado, ou Jogador. user_metadata nunca determina papel/grupo.

loadIdentity reexecuta o preparo idempotente na entrada privada. Se Auth confirmar a conta e a persistência falhar, a sessão continua real; a página mostra erro/repetição e a próxima tentativa retoma o preparo. Não apaga conta nem cria usuário fictício. save_my_identity grava profile/player próprios atomicamente: um campo inválido reverte ambos. Nenhum parâmetro de user_id, player_id, group_id ou papel é aceito nessa RPC.

create_group_once reutiliza create_group_impl; o primeiro owner continua único e ativo na mesma transação. add_guest_once reutiliza add_guest_impl e grava posição na mesma transação. Receipts em private.mutation_receipts usam PK (actor_user_id,request_id), operação, SHA-256 dos campos normalizados, resultado/grupo e created_at. Não guardam token, senha ou cópia dos campos. Repetir a mesma chave/payload retorna o mesmo resultado sob lock; chave reutilizada com outros campos falha. A autoridade de administrador é revalidada antes de retornar convidado. Falhas revertem recibo e domínio.

A chave fica estável no estado do formulário durante tentativas, inclusive após resposta de erro; o botão desabilita durante envio. Após sucesso de convidado, um marcador de navegação da solicitação reinicializa o formulário para um novo cadastro. UUIDs de solicitação não são segredos nem prova de acesso. Uma nova chave representa uma nova intenção: nomes iguais continuam permitidos, pois homônimos não são a mesma identidade. Não há exclusão, associação automática de convidados, transferência ou edição de papéis na UI.

## Migration e segurança

Arquivo novo: 20261020161609_stage003_identity_workflows.sql. Aplicado somente a hpbvtqvbtyioqjyelrpb, versão MCP 20261020162554. As seis anteriores não foram modificadas/reaplicadas. Novos objetos: uma tabela privada e quatro APIs públicas com implementações privadas. Tipos oficiais foram regenerados pelo MCP do schema remoto.

Exceção explícita ao padrão invoker anterior: as quatro novas entradas públicas são SECURITY DEFINER, owner app_executor NOLOGIN/NOBYPASSRLS, não postgres. Todas validam auth_user_id() e delegam apenas à sua implementação fixa, sem SQL dinâmico. EXECUTE somente authenticated e owner; nenhum novo helper privado recebe EXECUTE de clientes. Auxiliares obrigam identidade própria ou require_manager no grupo. Essa fronteira evita expor implementações privadas; os wrappers anteriores continuam invoker.

O owner técnico pode acessar suas tabelas, portanto essas quatro funções têm autorização explícita além do RLS das consultas. Não são bypass genérico: save/ensure não aceitam identidade alheia; criação usa a RPC administrativa existente; convidados verificam manager e grupo e nunca editam player vinculado. Recibos têm RLS e zero grants de cliente. CREATE temporário no schema público é concedido/revogado dentro da migration apenas para transferência de propriedade; o estado final confirmou CREATE=false. Nada foi concedido em auth.

A primeira tentativa de aplicação foi rejeitada pela revisão automática por grants diretos aos novos helpers privados. Foi revisada, sem contornar a rejeição. A tentativa seguinte falhou por CREATE exigido na transferência de owner; consultas confirmaram rollback integral e seis migrations. Depois da correção de grant temporário, a aplicação oficial teve sucesso e o histórico passou a sete. Nenhum SQL avulso criou objetos remotos.

Advisor atual: quatro WARN adicionais de SECURITY DEFINER autenticado correspondem exatamente às APIs intencionais acima; nenhuma delas concede acesso a anon. Os dois WARN preexistentes de rls_auto_enable continuam pendentes. Três INFO de RLS sem policy incluem convites, auditoria e recibos, todos fechados por decisão. A revisão de segurança é explicitada; avisos não foram eliminados com policies permissivas. Retenção dos recibos e anonimização continuam decisões antes de produção; não apagar recibos automaticamente, pois isso reduz a garantia de retry.

## Preparar o Codespaces

1. Usar develop, Node 24/npm 11 e npm ci. Não aplicar migrations existentes.
2. Configurar URL/chave publishable do desenvolvimento em .env.local ou secrets do Codespaces. O aplicativo não usa service role.
3. Definir NEXT_PUBLIC_SITE_URL como a origem HTTPS real da porta encaminhada, sem caminho. Em Auth → URL Configuration, configurar Site URL e permitir os callbacks exatos dessa origem: /auth/callback e /auth/callback?flow=recovery.
4. Conferir confirmação de e-mail e SMTP reais. Não desabilitar confirmação apenas para obter um teste aprovado. O app respeita session retornada por signUp; com confirmação habilitada aguarda e-mail.
5. Abrir links de confirmação/recuperação no navegador que iniciou a solicitação (verificador PKCE nos cookies). Links expirados/reutilizados devem falhar com opção de reenvio/recuperação.
6. Executar npm run dev ou npm run build e npm start. Manter o encaminhamento de porta privado.

## Script real de Auth/JWT e Data API

Pré-requisitos: HTTPS ao projeto, dois usuários **fictícios e confirmados** dedicados a testes, psql disponível e uma conexão PostgreSQL privilegiada de desenvolvimento para limpeza. Essa conexão não é usada em nenhuma requisição de usuário. Exigir sslmode=verify-full e CA configurada conforme a documentação do Supabase; não desabilitar TLS.

```sh
cp tests/integration.env.example work/stage003.test.env
# Preencher somente nesse arquivo ignorado ou em secrets do Codespaces.
node --env-file=.env.local --env-file=work/stage003.test.env scripts/test-stage003-integration.mjs --check
node --env-file=.env.local --env-file=work/stage003.test.env scripts/test-stage003-integration.mjs
```

O precheck só informa presença de configurações/ferramentas; não prova Auth. O script restringe URL/ref e a conexão de limpeza ao desenvolvimento, verifica psql/limpeza antes de criar dados, usa publishable + JWTs reais de A/B nas provas, não imprime credenciais, testa identidades, grupo/owner, slug duplicado, convidados/retry, perfil, isolamento, anonimato e logout. Em finally, remove apenas o grupo de slug UUID criado pelo teste, seus convidados identificados, vínculos/auditoria/recibos, e restaura campos próprios anteriores. Contas Auth preexistentes são preservadas. Interrupção forçada ou falha de limpeza exige revisão do manifesto work/integration-<UUID>.json; não executar deletes amplos.

Esse script testa SDK/Auth/Data API reais, não o navegador SSR inteiro. Completar manualmente a jornada abaixo. Não executado neste executor por falta de rede, contas de teste e conexão de limpeza; --check não é resultado aprovado de integração.

## Checklist de homologação no navegador

- Criar conta fictícia com nome; confirmar por e-mail real; verificar login, reload com sessão e saudação correta. Testar confirmação expirada e reenvio.
- Criar grupo com slug editado, observar owner único e retorno à página. Repetir envio em conexão lenta e conferir um único grupo.
- Adicionar convidado com posição; repetir pedido e conferir um único vínculo. Repetir nome com nova intenção e confirmar que homônimos são permitidos.
- Editar perfil próprio; voltar aos grupos e conferir apenas a identidade esportiva compartilhada.
- Em outro navegador/perfil, usuário B não deve ver grupo A nem acessar seu slug. Jogador comum não pode cadastrar convidados; forjar formulário/RPC deve falhar.
- Recuperar senha com e-mail real, testar link expirado e nova senha; logout deve fechar acesso privado; sessão expirada deve redirecionar ao login.
- Conferir celular/desktop e claro/escuro em todas as telas autenticadas. Não usar screenshots de sessão simulada como homologação.

**Status de conclusão:** implementação entregue e SQL verificado; Etapa 003 permanece pendente de homologação ponta a ponta até executar essa jornada com Auth/e-mail/SSR reais.

## Arquivos principais da entrega

- Páginas: dashboard e rotas groups/new, groups/[slug], profile, confirm-email, forgot-password e reset-password; login/signup/home e auth/callback atualizados.
- Domínio: src/features/identity/{server,actions}.ts; src/features/groups/{server,actions,validation}.ts e group-form.tsx; fluxos em src/features/auth.
- Interface: src/components/forms/{action-form,fields}.tsx e navegação AppShell; tokens globais existentes preservados.
- Infraestrutura: src/proxy.ts, src/lib/supabase/proxy.ts e tipos oficiais database.types.ts atualizados.
- Banco: somente a nova migration stage003_identity_workflows; mapeamento e hashes em supabase/development-migrations.json.
- Testes: auth-flows, domain-actions, domain-validation; stage003.sql e runner SQL ampliado; script test-stage003-integration.mjs e template integration.env.example.
- Documentação: README, AGENTS, PRODUCT, ARCHITECTURE, DATABASE, DECISIONS, DEPLOYMENT, VERIFICATION e este roteiro.

## Etapa 003.1 — Preview implantado; homologação pendente

Em 20/10/2026, a integração Vercel passou a acessar a equipe autorizada. Foi criado somente aplicativo-futebol (`prj_F4qeSw3UsqZzXj5cA89XSY5PgGnt`), vinculado ao repositório correto, com main como branch de produção e Preview develop. As três variáveis foram configuradas exclusivamente em Preview; proteção Vercel Authentication mantida.

Preview estável: https://aplicativo-futebol-git-develop-renan-ribeiros-projects.vercel.app. Deployment `dpl_3YCNKLneVfmhTBPNc6vVXLKgjeda` READY; build e páginas públicas HTTPS verificados. Ausência de sessão recusa /api/me e leva dashboard ao login. Callbacks sem código válido exibem o caminho de recuperação adequado.

**Nenhum dos 13 passos autenticados/e-mail/grupos acima foi homologado nesta execução.** Sem contas fictícias/caixas controladas e sem acesso da integração à configuração Auth/SMTP. Celular/desktop/escuro e retorno do e-mail através da proteção também permanecem pendentes no Preview. Não confundir os testes SQL anteriores com JWT real ou navegação autenticada.

Consultar [DEPLOYMENT.md](DEPLOYMENT.md) para URLs exatas de callback e recuperação, Site URL global/impacto no Codespaces, SMTP, auditoria atual e incidente da chamada de deploy cancelada. [VERIFICATION.md](VERIFICATION.md) registra as respostas realmente observadas. Nenhuma migration, dado real ou permissão sensível foi alterada; PR #1 segue em rascunho.

## Recuperação de senha — diagnóstico posterior (21/10/2026)

Tratamento de erros do callback corrigido, com categorias públicas seguras e encaminhamento de sb_flow_id quando disponível; código, hipóteses e limites em [RECOVERY-DIAGNOSIS.md](RECOVERY-DIAGNOSIS.md). Testes do SDK SSR real contra Auth sintético cobrem cookies, falta de verificador, sobrescrita e uso único. Nenhum teste com definição efetiva de senha e login real foi concluído; Etapa 003 permanece não homologada. Não confundir a autenticação observada numa primeira abertura com a conclusão de updateUser/login. Atualizar o alias www para o Preview da correção antes de ensaiar com uma conta fictícia controlada.
