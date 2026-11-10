# Homologação HTTP da 004.2 — executor A/B/C

Runner: `scripts/test-stage0042-http.mjs`. Implementado em 03/11/2026; **não homologado com JWT real nesta sessão**. Projeto permitido exclusivamente hpbvtqvbtyioqjyelrpb; migration esperada `20261029191222`, confirmada por MCP nesta rodada. O runner confirma a disponibilidade das tabelas pela Data API, mas não tem acesso administrativo ao histórico de migrations.

## Segurança e preparação

- Somente contas A/B/C exclusivas de homologação, já confirmadas e com perfil/jogador preparados pelo aplicativo. Não usar contas pessoais nem de jogadores reais. `TEST_ACCOUNTS_ARE_SYNTHETIC=1` é a declaração expressa do responsável; o Auth confirma identidade/conta, não a finalidade empresarial da conta.
- Variáveis em `tests/stage0042.env.example`. Senhas, chaves e tokens não são impressos, comitados ou persistidos pelo runner. Os dois flags devem ter valor exato 1, apenas quando a criação sintética estiver autorizada. Presença não comprova senha válida. Não há fallback para service_role/secret key, alteração de RLS ou simulação de JWT.
- Branches permitidas: develop e o nome exato test/stage0042-http (branch temporária autorizada para transferência/execução). main e quaisquer outras branches são rejeitadas. Node 24 e dependências existentes. `--use-env-proxy` respeita o proxy configurado no processo; não muda políticas de rede ou verificações TLS.
- Sem criação de contas, alteração de perfis globais, limpeza, migrações ou retry automático. Os grupos sempre são novos, com slug UUID próprio. Não reutiliza as fixtures da 003.2, grupo 4ª Força, Grupo Teste 2 ou o vínculo antigo de C.
- Os manifests/SQL ficam no `work/` ignorado, modo 0600, sem cookies, JWTs, senhas ou e-mails. Registram horários, HEAD, indicador de alterações locais e SHA-256 do runner/guards; checkpoints repetidos de preparação não inflam o total de cenários únicos. Os UUIDs técnicos e payloads sintéticos de identificação ficam privados. Manifests são atualizados por rename atômico e não podem ser symlinks. `--run` recusa repetir uma suíte já iniciada/completada/falhada após gravações; examinar o manifesto antes de qualquer recuperação manual.

## Três contas são suficientes

A será owner do grupo A; B será owner do grupo B e ator externo a A. C terá **um vínculo novo** em A, passando admin → player → guest sequencialmente pelas RPCs existentes chamadas por A. Cada mudança é conferida pela leitura autenticada de C. O JWT de C continua real: as permissões vêm do vínculo ativo no banco, não de adulteração de claims. A classificação de C permanece casual, preservando o guard guest/casual.

Não existe fluxo público de aceite de convite para inserir esse vínculo autenticado. Por isso, a preparação administrativa de **um INSERT limitado ao novo grupo A** é separada das provas HTTP. Ela não usa service_role para representar C nem altera vínculos anteriores. Sem essa preparação, os testes param. Ter quatro contas, sozinho, não resolve a ausência desse fluxo de vinculação.

## Execução no Codespaces

Confirmar o checkout e preservar qualquer alteração local:

```bash
cd /workspaces/aplicativo-futebol
git branch --show-current
git status -sb
```

Com secrets exportados no terminal, usar:

```bash
node --use-env-proxy scripts/test-stage0042-http.mjs --check
node --use-env-proxy scripts/test-stage0042-http.mjs --preflight
```

Se estiver usando arquivo privado ignorado, adicionar `--env-file=work/stage0042.test.env` imediatamente depois de `node --use-env-proxy`. Não sobrescrever arquivos privados existentes. Variáveis já exportadas têm precedência sobre o arquivo; corrigir secrets desatualizados no ambiente adequado sem enviar valores pelo chat.

- `--check`: não usa rede nem cria arquivos/fixtures; retorna presença, alvo, formato da chave publicável e declaração/flags. Exit 2 significa configuração incompleta ou não autorizada.
- `--preflight`: consulta health/Auth e `/rest/v1/groups?select=id&limit=0`, sem login, dados de grupos ou gravações. Exige resposta do endpoint HTTPS exato do projeto, sem redirect, JSON válido e o contrato esperado. Auth deve retornar 200 com identificação GoTrue/version. Data API deve negar a sondagem anônima com HTTP 401, code 42501, message `permission denied for table groups`, details null e hint presente null ou string de até 4.096 unidades UTF-16, sem NUL. Isso é `anonymous_access_denied`, connectivityConfirmed=true e **authorizationConfirmed=false**: permite somente avançar para autenticação. Chave inválida, JWT inválido, outro 401, erro de schema, resposta de outra origem/proxy ou acesso anônimo inesperadamente permitido bloqueiam o avanço (exit 2). Status null continua sendo falha de transporte/TLS/proxy, não reprovação de RLS. Não enviar a chave publicável como se fosse um JWT de usuário.
- Antes de qualquer fixture, A/B/C precisam autenticar normalmente, passar por getUser, confirmação de conta e identidades/sessões distintas. Depois, **cada conta** precisa ler groups, group_members, venues e as três tabelas novas, filtradas por UUID inexistente para não consultar dados preexistentes. Somente HTTP 200, sem erro, com array vazio permite prosseguir; qualquer falha impede a criação de grupos. Isso verifica os acessos de leitura da sessão; a autorização linha a linha e por papel ainda depende da matriz posterior.

Somente depois de configuração e conectividade válidas:

```bash
node --use-env-proxy scripts/test-stage0042-http.mjs --prepare
```

Essa etapa autentica as três contas, exige getUser confirmado/IDs e tokens distintos, verifica as identidades esportivas existentes e as três tabelas antes de criar dois grupos vazios (UTC), cada um pelo create_group_once com request ID previamente registrado. Não modifica perfis. Gera:

- `work/stage0042-http-RUN_UUID.json`
- `work/stage0042-http-RUN_UUID-membership.sql`

O resultado **BLOCKED_MEMBERSHIP_SETUP não é PASS da suíte**. Revisar o SQL privado e executá-lo uma única vez por uma ferramenta administrativa autorizada (por exemplo, SQL Editor do projeto correto). É DML de fixture, não migration: uma transação que valida grupos UUID/slugs, criadores, owner único/ativo, elenco inicial exato e jogador de C, inserindo somente o novo vínculo player/active. Sem grants, alteração de functions/triggers, UPDATE, DELETE ou auth claims simuladas. Repetição ou estado divergente abortam. A preparação também cria o evento de auditoria normal do vínculo pelos triggers existentes.

Após essa etapa controlada:

```bash
node --use-env-proxy scripts/test-stage0042-http.mjs --run RUN_UUID
```

Substituir RUN_UUID pelo identificador retornado por `--prepare`, sem criar outra execução ou reutilizar manifestos da 003.2. O runner reautentica as mesmas três identidades, confere grupos/owners/vínculo e exige tabelas novas ainda vazias nesses grupos. Depois cria locais e configurações sintéticas exclusivamente nesses grupos. Nenhuma operação altera grupos anteriores. Se houver erro, não repetir automaticamente; guardar o manifesto, os request IDs, o checkpoint e a última resposta sanitizada. Resposta de transporte perdida após INSERT pode significar uma linha criada: conferir pelo owner no grupo UUID exclusivo antes de qualquer recuperação, sem presumir rollback de rede.

## Matriz implementada

| Ator                          | SELECT                                     | INSERT/UPDATE                                                     | DELETE |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------------------- | ------ |
| Owner A/B                     | Dados do próprio grupo                     | Agendas, preços e classificações válidas                          | Negado |
| Admin C                       | Agendas/preços e classificações do grupo A | Agenda/classificação permitidas; preços e vencimentos negados     | Negado |
| Player C                      | Agendas/preços e classificações próprias   | Administrativo negado                                             | Negado |
| Guest C autenticado           | Agendas/preços e classificações próprias   | Administrativo negado; gestor não pode classificá-lo como monthly | Negado |
| A acessando B e B acessando A | Sem linhas                                 | Negado                                                            | Negado |
| Anônimo com chave publicável  | Negado                                     | Negado                                                            | Negado |

Verificações adicionais: schema private fora da Data API; autoelevação e adulteração de group_id/member_id em RPC negadas com elencos inalterados; UPDATE de id/group_id/player_id/created_at; venue e player de outro tenant; duração/dia/âncora/datas/intervalos inválidos; preços negativos, NULL incoerente e vencimento 0/32; sobreposição de preço/classificação; versão iniciada imutável; retroatividade negada; períodos adjacentes permitidos; duas corridas HTTP de sobreposição com um vencedor; owners únicos preservados e C guest/active no **novo** vínculo final. As provas usam o JWT do ator, não conexão postgres.

Cada escrita negada exige comparação de snapshots posteriores lidos pelos owners legítimos dos dois grupos, incluindo timestamps. Zero linhas pode provar uma negativa de UPDATE/DELETE, mas não INSERT. Erro de constraint não é aceito como prova de autorização; erro de schema/JWT/rede não é tratado como RLS válida. Tentativas e linhas retornadas são registradas incrementalmente, sem exclusão automática.

`member_billing_terms` usa player_id: rejeição de coluna inexistente member_id não comprova isolamento. member_id é testado onde realmente existe, na RPC de integrantes.

## Limites e interpretação

- `result=PASS` refere-se aos checkpoints implementados, não encerra automaticamente a etapa. Revisar o manifesto e as limitações antes do parecer final.
- Não há RPC pública de sucessão financeira atômica; duas chamadas REST não equivalem a transação. Não libera esse fluxo de interface sem implementação/homologação futura.
- Imutabilidade de histórico já expirado permanece coberta pelo SQL local; o runner não desabilita triggers nem faz backdating privilegiado para fabricar histórico remoto. Testa versão iniciada e rejeição de retroatividade pela Data API.
- Mantém fixtures e estados finais para revisão. Não fornece comando de limpeza global. Somente IDs criados nesta execução poderão ter limpeza posteriormente autorizada/revisada; nenhum usuário existente será removido.

Testes unitários do runner são mocks explícitos, não JWTs reais. O runner PostgreSQL descartável inclui uma prova do SQL de preparação gerado e de rejeição de replay sem mudanças, além das regressões. Nenhuma dessas provas locais substitui a execução HTTP.

## Resultado no executor desta sessão

Ambiente efetivamente acessível: `/workspace`, sem Codespaces/secrets. `--check`: exit 2, variáveis ausentes; `--preflight`: exit 2, nenhuma resposta HTTP do Supabase; curl confirmou CONNECT 403 em Auth/Data API. `--prepare`: bloqueado antes de criar manifesto ou fixture. **Zero checkpoints JWT reais executados. NÃO APTO.** Sem push, deploy, novas migrations, mudanças de permissões ou registros hospedados nesta implementação.

## Transferência por branch temporária — 04/11/2026

Branch de entrega: `test/stage0042-http`, baseada em `667940c13324782cbc959fb7911f6809c9d0f913`. O runner aceita essa branch explicitamente para evitar cherry-pick/merge em develop apenas para testar. A preparação e a matriz continuam dependendo de secrets, conectividade e autorização para fixtures; nenhum desses modos foi executado contra o Supabase nesta publicação. Não há merge ou mudança na Production Branch.

No Codespaces, preservar alterações locais e usar:

```bash
git status -sb
git fetch origin test/stage0042-http
git switch --track origin/test/stage0042-http
```

Se a branch local já existir, usar `git switch test/stage0042-http` e conferir divergências antes de atualizar. Se houver conflito ou impedimento por alterações locais, interromper sem reset/clean/stash automático. Seguir depois os modos --check, --preflight, --prepare e --run descritos acima. Nunca usar --prepare apenas como verificação inofensiva: ele cria grupos quando os pré-requisitos são aprovados.

## Correção do preflight anônimo — 04/11/2026

O preflight anterior exigia 200 antes do login na Data API e classificava genericamente 401, confundindo uma negativa PostgreSQL legítima com problema de conexão. Também deixava --preflight sair com zero para qualquer resposta HTTP. Corrigidos ambos os gates: agora somente o contrato estrito acima permite avançar para as verificações autenticadas. Respostas e mensagens completas nunca são registradas. O módulo de classificação possui testes offline e o manifest registra também seu SHA-256.

Esta correção permanece local na branch test/stage0042-http, sem push/merge/deploy. Nenhuma execução contra o Supabase remoto ou criação de fixtures nesta rodada. A evidência real 200 Auth/401 PostgreSQL foi informada pelo responsável; os novos resultados são de testes locais, não nova homologação real. **004.2-H continua NÃO APTA.**

## Compatibilidade de hint PostgREST — 10/11/2026

A resposta informada no Codespaces contém hint não nulo. O contrato passa a aceitar somente hint presente e null ou texto de até 4.096 unidades UTF-16, sem NUL, como diagnóstico opaco. Texto vazio e multilinha são válidos. Não executa ou registra a orientação do hint. Números, booleanos, arrays, objetos, campo ausente, NUL e excesso de tamanho continuam bloqueados. O envelope deve ser objeto JSON com code/message/details/hint presentes; details permanece null, HTTP 401/code 42501 e mensagem exata de groups permanecem obrigatórios, assim como origem/URL, ausência de redirect e content-type. Nenhum 401 genérico ou erro JWT/chave passa pelo gate. As barreiras autenticadas A/B/C antes de fixtures permanecem inalteradas.

A correção foi testada somente localmente; nenhuma resposta real foi reexecutada nesta rodada. Os testes reproduzem o formato textual não nulo de PostgREST, sem alegar conhecer o texto integral do hint observado. Sem mudança de esquema/configuração, fixture remota, merge ou deploy manual. A transferência é exclusivamente pela branch test/stage0042-http; 004.2-H continua NÃO APTA.
