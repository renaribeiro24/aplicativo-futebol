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

Excluídos intencionalmente: work/ (inclui credenciais e cópias anteriores), .env.local e outros ambientes, node_modules, .next, caches, next-env.d.ts gerado, logs e artefatos de testes. Ícones PNG, lockfile, frontend, PWA, testes, documentação, scripts, migrations e devcontainer fazem parte do código a publicar. Nenhum segredo foi encontrado na varredura por padrões nos fontes e no histórico inicial; isso não é garantia universal de detecção. A árvore remota será comparada integralmente com o commit após push. O PR permanecerá rascunho enquanto os bloqueios de integração existirem.
