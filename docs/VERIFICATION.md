# Verificação — Etapa 002.2 (20/10/2026)

Estado atual: cinco migrations implantadas em hpbvtqvbtyioqjyelrpb; integração remota **bloqueada** pela falta de USAGE de app_executor em auth. Consulte DEPLOYMENT.md para versões, diagnóstico, correção proposta e limites.

| Verificação executada             | Resultado                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Auditoria Git/GitHub              | 83 arquivos iniciais elegíveis; remoto somente main no commit inicial, sem conflito; work/ e ambientes ignorados                      |
| Varredura de segredos             | Nenhum padrão de token/chave privada/JWT/URL de banco com senha nos fontes elegíveis ou histórico inicial; repetida antes do commit   |
| npm ci inicial                    | Falhou no download do CLI (DNS fora do proxy); não tratado como sucesso                                                               |
| npm ci com npm_config_https_proxy | Passou: 673 pacotes, instalador oficial com proxy suportado, TLS/checksum preservados                                                 |
| Supabase local oficial            | Tentado; bloqueado por public.ecr.aws Forbidden; não equivale a teste completo                                                        |
| npm run db:test                   | Passou: cinco migrations, 70 asserções e duas corridas; authenticated/anon não privilegiados                                          |
| Proposta auth-schema-bridge       | 70 asserções e duas corridas passaram em PostgreSQL descartável; não aplicada ao remoto                                               |
| Aplicação remota                  | Cinco chamadas apply_migration bem-sucedidas; histórico conferido; SQL idêntico aos arquivos locais por MD5                           |
| Catálogo remoto                   | Oito tabelas públicas + auditoria privada, todas com RLS; 63 constraints, 31 índices, ACLs e funções conferidos                       |
| Smoke SQL remoto                  | FALHOU em auth.uid(): permission denied for schema auth. Fixtures revertidas; zero linhas de aplicação confirmadas depois             |
| Advisors segurança                | Dois WARN na função preexistente rls_auto_enable; dois INFO de tabelas intencionalmente fechadas                                      |
| Advisors desempenho               | 13 INFO de índices novos sem uso                                                                                                      |
| Tipos oficiais                    | Gerados por MCP do schema remoto e aplicados aos clientes browser/server/proxy; sem interfaces Database manuais                       |
| npm run lint                      | Passou                                                                                                                                |
| npm run typecheck                 | Passou                                                                                                                                |
| npm test                          | Passou: 5 arquivos, 27 testes                                                                                                         |
| npm run build                     | Passou sem configuração e com .env.local publicável ativo                                                                             |
| HTTP local do build configurado   | /, /login, /signup, manifesto e ícone: 200; /dashboard: 307 para login com no-store; /api/me: 401 com no-store                        |
| HTTP Supabase remoto              | Tentado; proxy CONNECT 403. Liberação de rede solicitada                                                                              |
| Auth/JWT real                     | Não executado; sem conectividade e credencial administrativa de teste disponível                                                      |
| Push e PR                         | develop enviada; PR #1 rascunho aberto; clonagem nova confirmou 88 arquivos idênticos, todos os 83 originais presentes e main intacta |

Uma execução inicial adicional do runner SQL encontrou o servidor temporário de inicialização já pronto e falhou quando ele encerrou; a espera agora exige o processo postgres definitivo como PID 1. O runner corrigido concluiu todas as verificações. Os resultados abaixo são históricos das etapas anteriores e não substituem os resultados atuais.

---

# Verificação — Etapa 002

Executada em 19/10/2026, Node 24.19.0/npm 11.9.0, checkout `/workspace/aplicativo-futebol`. Nenhum projeto remoto foi vinculado, nenhum SQL remoto foi executado e nenhuma credencial real foi configurada. Não houve deploy.

## Resultados executados nesta etapa

| Verificação                          | Resultado                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| CLI Supabase 2.81.3                  | `--version`/`--help` verificados; cinco migrations criadas com `migration new`                                 |
| Migrations em PostgreSQL descartável | As cinco passaram, em ordem e em transações, incluindo constraints diferidas                                   |
| `npm run db:test`                    | Passou: 70 asserções SQL e dois cenários concorrentes, com bancos novos descartáveis                           |
| RLS de cliente                       | session_user/current_user authenticated e anon, não service_role; acesso cruzado e escrita indevida rejeitados |
| Disputa da última vaga               | Duas conexões autenticadas; exatamente uma confirma/commita; contagem final igual a 1                          |
| Transferências concorrentes          | Duas conexões do owner inicial; uma vence, a outra revalida a permissão e falha; exatamente um owner final     |
| `npm run lint`                       | Passou sem avisos/erros; reexecutado após ajuste do runner                                                     |
| `npm run typecheck`                  | Passou: next typegen + tsc --noEmit                                                                            |
| `npm test`                           | Passou: 5 arquivos e 27 testes existentes                                                                      |
| `npm run build`                      | Passou; UI e Auth anteriores preservados, sem necessidade de Supabase configurado                              |
| `npm run check`                      | Passou, sequência completa de lint, tipos, testes e build                                                      |
| `npm run db:types`                   | Tentado, retornou código 1: `supabase start is not running`; nenhum arquivo Database foi criado/sobrescrito    |

A formatação e `git diff --check` foram executados ao encerrar a documentação. Não foi repetido o teste visual da Etapa 001, pois as páginas/componentes de UI não foram alterados funcionalmente nesta etapa.

## O que os testes SQL comprovam

O runner usa Docker local explicitamente, ignora seletores de daemon remoto e cria PostgreSQL 17.6 fixado por digest, sem rede nem portas expostas. O bootstrap fornece somente papéis, auth.users(id) e auth.uid(): as tabelas, privilégios, RLS, constraints, locks e transações testados são PostgreSQL reais.

As fixtures são sintéticas e separadas das migrations. Depois da preparação, o teste usa SET SESSION AUTHORIZATION para remover a identidade privilegiada também de session_user, não apenas current_user. Há verificações separadas e identificadas como privilegiadas para defesa contra DML do dono e inspeção da auditoria; elas não são apresentadas como provas de RLS de cliente.

Cobertura inclui perfis próprios/terceiros, player global e convidado da origem, isolamento A/B, usuário nos dois grupos sem poder mover linhas, autoelevação, admin contra owner, último owner, convites/hash/listagem sanitizada, papel técnico sem login/superuser/BYPASSRLS/leitura de Auth, FK local-partida de grupos distintos, inscrições duplicadas, vínculo suspenso/inelegível, capacidade, reingresso e audit trail. Uma falha temporária injetada na segunda escrita da transferência comprova rollback da despromoção anterior. Erro de slug/fuso na criação do grupo também reverte player recém-criado.

Durante a elaboração, foram corrigidas as próprias asserções para não aproveitar o session_user postgres da preparação e para distinguir a proteção de FK histórica da constraint de owner. A execução final usa papéis de sessão não privilegiados e checagens exatas de contagem; nenhuma policy foi relaxada para passar testes.

## Limites e pendências de validação

- Não foi iniciada a pilha Supabase completa (GoTrue, PostgREST/JWT, Storage, extensões e default privileges próprios). Não declarar Auth ou integração HTTP/RLS completos como testados.
- `db lint` e advisors do Supabase local estão preparados/documentados, mas não foram executados sem essa pilha. A criação das funções/SQL e os caminhos de autorização foram exercitados em PostgreSQL; isso não substitui o lint completo de todas as rotinas e serviços.
- Geração oficial de tipos está preparada por `npm run db:types`, apenas `--local --schema public`. O comando recusou gerar sem a pilha local. Não foi criado tipo Database manual, e os clientes só deverão receber esse genérico após a geração real validada. Hoje o frontend só chama Auth.
- Não foi construída a imagem de devcontainer com a nova feature Docker-in-Docker. Docker do ambiente disponível funcionou nos testes.
- Nenhum token real, fluxo de aceite de convite, apropriação de convidado, Storage, promoção FIFO ou eliminação de PII foi implementado/testado.
- Antes de homologação: validar na pilha Supabase local completa e versão PostgreSQL alvo, executar lint/advisors, gerar tipos e testar HTTP com JWTs de desenvolvimento. Revisar schema/histórico remoto somente com autorização.

O CLI npm teve falha de download por não usar o proxy deste ambiente. A instalação usou o pacote 2.81.3 fixado e binário oficial obtido pelo proxy autorizado, com SHA-256 conferido contra o manifesto de checksums da mesma release. Binário/tarball ficam somente em node_modules/work ignorados. Nenhum login/configuração pessoal de conta foi realizado. O aviso já conhecido do ESLint 9 permanece documentado na Etapa 001.

---

## Histórico: evidências da Etapa 001

O conteúdo abaixo registra a etapa anterior, não substitui as verificações atuais nem afirma que banco/serviços remotos foram testados naquela ocasião.

# Verificação da fundação

Executada em 19/10/2026, no checkout `/workspace/aplicativo-futebol`, com Node 24.19.0 e npm 11.9.0. Nenhum .env.local ativo e nenhuma credencial remota foram usados.

## Comandos executados

| Comando                             | Resultado observado                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm ci --no-audit --no-fund`       | Instalação limpa pelo lockfile concluída; 652 pacotes instalados                              |
| `npm run lint`                      | Passou, sem erros nem avisos de lint                                                          |
| `npm run typecheck`                 | Passou: next typegen + tsc --noEmit, strict                                                   |
| `npm test`                          | Passou: 5 arquivos, 27 testes                                                                 |
| `npm run build`                     | Passou: rotas compiladas, tipos checados e páginas públicas geradas sem configuração Supabase |
| `npm run check`                     | Sequência final lint → typecheck → testes → build concluída com código 0                      |
| `npm start -- --hostname 127.0.0.1` | Build de produção iniciou na porta 3000; usado no teste de navegador                          |
| `npm run dev`                       | Servidor Turbopack iniciou na porta 3000; home retornou 200 e renderizou no Chromium          |

Formatação e integridade de whitespace foram conferidas ao encerrar a documentação. Versões exatas estão no package.json/lockfile. npm emite aviso de fim de suporte de ESLint 9; essa linha foi mantida por ser a compatível com os plugins atuais do eslint-config-next. TypeScript 6.0.3 atende ao peer `<6.1.0` do parser; TypeScript 7 da implementação anterior não atendia. A atualização coordenada das ferramentas está registrada como pendência.

O primeiro build em sandbox falhou ao obter a saída de um subprocesso TypeScript (`Could not parse output from TypeScript's --showConfig`). O mesmo comando com permissão de execução dos subprocessos passou; nenhum teste foi removido e nenhuma opção ignoreBuildErrors foi ativada. O comando final completo foi executado com essa permissão.

## Cobertura automatizada

Os testes permanentes em `tests/` verificam:

- Configuração ausente, URL inválida, HTTPS fora de localhost e rejeição de chave privilegiada/legada no campo publicável.
- Validação de cadastro e origem de callback, sem modificar senha ao normalizar e-mail.
- Guarda de sessão com usuário confirmado ou recusado pelo provedor simulado.
- Proxy sem configuração, redirecionamento de área reservada e preservação de cookies/cabeçalhos na renovação simulada.
- API de identidade: 503 sem configuração, 401 sem usuário, 200 somente com ID/e-mail do usuário simulado validado.
- Chamadas diretas de Server Actions recusadas sem configuração, mesmo se alguém contornar o formulário desabilitado.

Mocks explicitamente isolam Supabase e não representam uma integração real. Nenhum teste unitário chama Auth, PostgreSQL ou Storage remotos.

## Navegador

Chromium do ambiente, executado sobre o build de produção: viewport desktop 1440 px e móvel 390 px, tema claro em ambos e tema escuro no móvel. Resultados:

- Página pública e idioma pt-BR corretos; links de login/cadastro funcionam.
- Formulários desabilitados com aviso de configuração pendente.
- Dashboard mostra somente preparação, sem título/conteúdo da sessão privada.
- `/api/me` retorna 503 com Cache-Control contendo no-store.
- Callback inválido redireciona para login com mensagem de erro.
- Manifesto responde 200, tem idioma e display corretos, e todos os ícones declarados respondem 200.
- Página inexistente mostra estado 404.
- Sem overflow horizontal na home e no dashboard nos tamanhos verificados.
- Zero erros JavaScript não tratados e zero requisições externas em cada um dos três cenários.

A inspeção visual das capturas desktop e móvel confirmou layout legível e consistente. O script temporário e as capturas estão em work/ ignorado. Durante o ajuste do script de QA, duas asserções foram corrigidas: esperar a transição do App Router e distinguir o título privado do texto de aviso que menciona sessão de demonstração. Não houve mudança de funcionalidade para satisfazer os testes.

## Limites explícitos

Não foram executados: autenticação real, entrega de e-mail, renovação real de token, teste SQL, criação/aplicação de migrations, advisors de banco, políticas RLS/Storage, Docker build do devcontainer, Vercel/deploy ou instalação/offline PWA. As políticas RLS e o schema estão somente documentados. Nem os testes nem a UI afirmam que essas integrações estão funcionais.

O devcontainer foi configurado, mas a imagem não foi construída neste ambiente. Há manifesto/ícones PWA, sem service worker. Os próximos testes de integração devem ocorrer em instância local descartável ou ambiente explicitamente autorizado, conforme docs/DATABASE.md.
