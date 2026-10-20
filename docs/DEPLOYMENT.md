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
