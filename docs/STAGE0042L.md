# Etapa 004.2-L — Local principal: patch para revisão

> **Revisão posterior — localização integrada:** o SQL ainda não aplicado foi ampliado nesta tarefa para coordenadas, identificador externo, versionamento de locais referenciados e defaults com override em novas agendas/partidas. SHA-256 atual: `42f7be1b5bb9d7c8d9ec7648686966e73a6f752836371327274bb791f30d5a66`. A auditoria abaixo descreve exclusivamente o hash anterior `d50d527d…`, não aprova esta revisão. Regras de endereço, assinatura RPC e geração de tipos descritas historicamente abaixo foram substituídas no patch atual; consulte [Dados gerais e localização integrada](GROUP-LOCATION.md). Nova revisão remota somente leitura e comprovação de recuperação continuam necessárias; parecer permanece **NÃO APTO para aplicação remota**. Nenhum SQL remoto executado nesta revisão.

## Escopo e parecer — 13/11/2026

Preparação original: patch local na branch `feat/stage0042-operational`, sobre `2470d33d613d57ef8a1378294d21d47839557615`, sem SQL remoto naquela fase. Na auditoria subsequente abaixo, o Supabase foi consultado somente para metadados, histórico e Advisors, sem DDL/DML ou alteração administrativa. Sem commit, push, deploy, mudanças no Auth ou credenciais novas. As oito migrations anteriores e os tipos usados pela aplicação permanecem intactos.

**Parecer pré-aplicação atual: NÃO APTO neste momento**, por falta de comprovação de backup recuperável. A compatibilidade técnica dos objetos auditados foi confirmada, sem drift impeditivo; a recuperação é um gate obrigatório ainda não atendido. A auditoria e as condições de liberação estão registradas ao final. O parecer preliminar “APTO para solicitar autorização”, baseado em testes locais, era condicionado a esse preflight e não constitui autorização de aplicação.

O SQL completo proposto está em [20261113143648_stage0042l_primary_venue.sql](../supabase/migrations/20261113143648_stage0042l_primary_venue.sql), criado oficialmente por `supabase migration new stage0042l_primary_venue`. SHA-256 auditado: `d50d527d8c7e5bb806e620ca3b19f8efc10d5125d382a6af70228edc76d38f99`.

## Modelagem

- `groups.primary_venue_id uuid NULL`, sem default, inferência ou backfill. No máximo um principal por grupo, com grupos legados inicialmente sem principal.
- FK `(groups.id, groups.primary_venue_id)` → `venues(group_id,id)`, aproveitando a unicidade composta existente. DELETE RESTRICT; sem cascade. Índice parcial em `groups.primary_venue_id` apoia verificação de referências e ciclo de vida.
- Sete campos nullable novos em venues: postal_code, street, street_number, complement, neighborhood, city e state. Não se modifica venues.address, nem se interpreta seu texto livre.
- CHECK aceita o endereço estruturado inteiramente ausente para locais legados; se houver dados estruturados, todos os campos obrigatórios precisam estar completos. CEP de oito dígitos preserva zeros iniciais; logradouro até 200 caracteres, número textual até 30 (aceita s/n), bairro/cidade até 120, UF válida das 27 unidades brasileiras. Complemento opcional até 120. Nome conserva seu CHECK existente de 1–120 caracteres.
- Local principal precisa pertencer ao grupo, estar ativo e ter endereço estruturado completo. Guardas também protegem contra desativação e perda de endereço do local principal em manutenção privilegiada. A FK impede exclusão do local referenciado. Nenhum caminho de exclusão foi criado.

## Operação transacional

API proposta, única assinatura pública, sem overload:

```sql
public.save_group_primary_venue(
  p_group_id uuid,
  p_name text,
  p_postal_code text,
  p_street text,
  p_street_number text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_venue_id uuid default null,
  p_expected_primary_venue_id uuid default null,
  p_expected_venue_updated_at timestamptz default null,
  p_complement text default null
) returns uuid
```

O wrapper público é SECURITY INVOKER e delega a `private.save_group_primary_venue_impl`, SECURITY DEFINER de app_executor (NOLOGIN, NOSUPERUSER, NOBYPASSRLS), com search_path vazio e referências qualificadas. Esse padrão já é utilizado no repositório. O definer privado é necessário para não conceder escrita direta no ponteiro/endereço aos clientes: um invoker puro exigiria ampliar grants ou conceder o helper de autorização/lock. O executor técnico usa a propriedade das tabelas para realizar somente a operação controlada, após autorização explícita; não recebe novos privilégios no Auth. O schema private continua fora da Data API.

A implementação chama `private.require_manager` para bloquear o grupo e, depois da espera, revalidar vínculo ativo owner/admin. Compara o ponteiro atual com p_expected_primary_venue_id. Se p_venue_id for omitido, cria um local novo explicitamente; nunca escolhe por nome, ordem ou quantidade. Se informado, verifica grupo/atividade, bloqueia a linha do local e exige p_expected_venue_updated_at igual ao updated_at carregado pelo cliente. Atualiza nome/endereço estruturado e define o principal na mesma transação. Não grava fuso, preços, papéis, venues.address ou agendas existentes.

Todos os campos obrigatórios e limites são verificados pelo banco. Entrada inválida, identidade incorreta, nome duplicado, versão desatualizada ou falha posterior revertem a operação inteira; nenhum local órfão é confirmado. O caller futuro deve derivar group_id da rota autorizada, validar o formulário no servidor e só confirmar sucesso após retorno válido/recarga. Não implementar dois pedidos HTTP como uma troca atômica.

### Permissões e erros

| Perfil                  | Consultar local do próprio grupo | Definir/criar/atualizar principal | Escrita direta nas colunas novas |
| ----------------------- | -------------------------------- | --------------------------------- | -------------------------------- |
| Owner ativo             | Sim, RLS existente               | Sim, RPC autorizada               | Não                              |
| Admin ativo             | Sim, RLS existente               | Sim, RPC autorizada               | Não                              |
| Player/guest ativo      | Sim, RLS existente               | Não                               | Não                              |
| Outro grupo/sem vínculo | Não                              | Não                               | Não                              |
| Anônimo                 | Não                              | Não                               | Não                              |

Não foram alteradas policies/grants de tabela existentes. Novas colunas herdam somente a leitura já autorizada das tabelas. EXECUTE é concedido a authenticated apenas para o wrapper e a implementação privada, a qual repete toda a autorização. PUBLIC, anon e service_role não recebem EXECUTE nos novos endpoints; triggers privados não têm EXECUTE de cliente. A migration rejeita ownership/RLS divergentes e grants prévios amplos que exporiam INSERT/UPDATE nas colunas novas para anon/authenticated/service_role. Não tenta consertar o ambiente.

Erros relevantes: 42501 autorização/grant; 23503 local inexistente, desativado ou de outro grupo; 23514 endereço/integridade; 23502 campo obrigatório nulo; 23505 nome ativo duplicado; 40001 ponteiro/versão desatualizados; 40P01 conflito de locks detectado pelo PostgreSQL. O frontend futuro deve sanitizar a mensagem e exigir recarga para 40001/40P01. Não realizar retry automático nem converter updated_at para precisão menor: enviar a string original completa quando se editar um local.

## Concorrência e agendas

RPCs bloqueiam grupo → local. Dois pedidos com a mesma versão têm um vencedor e um conflito, sem sobrescrever silenciosamente a edição concorrente. Reenvio de criação com expectativa de ponteiro nulo também falha após uma criação confirmada, sem gerar outro local. O helper já existente serializa alterações de papéis com essas operações.

O novo trigger `aa_schedule_primary_venue` executa somente BEFORE INSERT, antes de configuration_guard. Após o lock/autorização, lê o principal do próprio grupo e o atribui a venue_id, ignorando o valor enviado pelo cliente quando houver principal. O guard e a FK existentes continuam verificando local ativo e pertencimento. A criação que aguarda uma troca do principal usa a versão confirmada após a espera.

**Compatibilidade de transição:** enquanto primary_venue_id estiver nulo, mantém-se exatamente o comportamento anterior de local manual ou opcional. Não é feito fallback inferido nem se bloqueiam todos os grupos existentes após uma migration sem backfill. Esse comportamento também passou pelas 109 asserções antigas. Após a definição explícita do principal, novas agendas o utilizam automaticamente. Atualizações de agendas anteriores nunca passam pelo trigger novo; vínculos anteriores, inclusive NULL, permanecem. A futura interface deve retirar a escolha manual apenas na criação sob o novo fluxo, preservando a edição/histórico anterior. Nenhuma tela dependente do novo esquema foi habilitada aqui.

Ressalva comprovada: o trigger anterior venues_validate também pede lock de grupo durante UPDATE direto de local. Uma atualização direta concorrente pode formar ordem inversa com a RPC e causar 40P01. O teste reproduziu essa disputa e confirmou rollback seguro, sem principal desativado persistido. Não se reescreveu a função anterior nem se afrouxou sua autorização. A RPC entre si usa ordem consistente; manutenção direta deve adquirir previamente lock do grupo ou tratar aborto/recarga. Nomes/endereço de um mesmo local não têm snapshots históricos no modelo: editar explicitamente seu cadastro pode mudar os atributos exibidos por agendas antigas, mas não seus IDs/referências nem o texto address original.

## Validação local da preparação (anterior à auditoria remota)

Ambiente: Node 24.19.0, npm 11.9.0, Supabase CLI 2.121.0, Docker 28.4.0, PostgreSQL 17.6-bookworm fixado por digest no runner. Sem portas publicadas e com network=none. O Auth deste banco é o bootstrap mínimo dos testes; não é o Supabase Auth completo.

| Critério                                                                       | Resultado/evidência                                                                                                                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oito migrations anteriores intactas e nona aplicada localmente                 | PASS, ordem integral no runner                                                                                                                            |
| Preservação de grupos/fuso/locais/timestamps/agendas/partidas legados          | PASS, snapshots comparados em transação com fixtures sintéticas anteriores à migration                                                                    |
| Ausência de backfill                                                           | PASS, ponteiros permanecem nulos até configuração explícita                                                                                               |
| Rollback de DDL após erro tardio                                               | PASS, sem coluna/função residual                                                                                                                          |
| Drift de RLS/grants amplos                                                     | PASS, três cenários rejeitados e revertidos                                                                                                               |
| Permissões/integridade da 004.2-L                                              | PASS, 52 asserções SQL com session_user/current_user authenticated/anon; papéis owner/admin/player/guest conferidos                                       |
| Definição, edição, UF/CEP/obrigatoriedade, ausência/desativação e outro tenant | PASS                                                                                                                                                      |
| Rollback da RPC após INSERT e erro forçado na atribuição                       | PASS, sem órfão nem troca do ponteiro                                                                                                                     |
| Disputa entre duas definições e duas edições                                   | PASS, um vencedor e rejeição de versão obsoleta                                                                                                           |
| Admin rebaixado enquanto espera                                                | PASS, escrita negada após lock                                                                                                                            |
| Criação de agenda concorrente com troca do principal                           | PASS, usa principal confirmado                                                                                                                            |
| Disputa com arquivamento privilegiado de local                                 | PASS de integridade; conflito abortado com segurança, ressalva 40P01 acima                                                                                |
| Regressões SQL após as nove migrations                                         | PASS, 70 asserções de segurança, 109 da 004.2, 10 de settings e demais regressões de identidade/grupos/convidados/convites, isolamento e concorrência     |
| Tipos oficiais locais                                                          | PASS, gerados após validação pelo CLI e formatados por Prettier                                                                                           |
| Testes unitários/lint/typecheck/build                                          | PASS: 429 testes em 27 arquivos, lint sem warnings, typecheck e build; nenhuma unidade usa SQL remoto                                                     |
| Auth real, JWTs e Data API do novo endpoint                                    | NÃO EXECUTADO; não confundir claims SQL com JWTs reais                                                                                                    |
| Advisors oficiais Supabase                                                     | NÃO EXECUTADO na preparação local inicial; consultados posteriormente na auditoria abaixo. A análise de ACL/RLS/ownership local não substitui os Advisors |

Logs locais ignorados: work/stage0042l-sql.log e work/stage0042l-{unit,lint,types,build}.log. Fixtures vivem exclusivamente nos contêineres criados pelo runner e são destruídas com seus próprios volumes; nenhuma limpeza remota ou de registros preexistentes foi executada. As evidências anteriores 003.2/004.2-H permanecem intactas.

### Reproduzir somente no ambiente local

```bash
npm run db:test
STAGE0042L_GENERATE_TYPES=1 npm run db:test
npm test
npm run lint
npm run typecheck
npm run build
```

O segundo comando opcional usa o binário oficial do CLI instalado, no mesmo contêiner PostgreSQL já validado, exclusivamente pelo loopback interno. TLS desabilitado somente nessa conexão dentro do contêiner sem rede; não é uma recomendação para conexões reais. Nenhuma porta/URL de projeto é aceita como entrada. Essa geração adicional suporta Linux x64; falha claramente em outras plataformas. A saída fica em [tests/database/generated/stage0042l.database.types.ts](../tests/database/generated/stage0042l.database.types.ts), separada do contrato atual src/types/database.types.ts. Apenas comentário de procedência e Prettier são acrescentados. Tipos descrevem o esquema, não substituem grants/RLS. Não editar Database à mão ou substituir os tipos do aplicativo publicados antes da aplicação/homologação autorizadas do novo esquema.

## Plano de aplicação futura — somente após autorização específica

1. Confirmar projeto hpbvtqvbtyioqjyelrpb, histórico das oito migrations aplicadas e mapeamento local/remoto de supabase/development-migrations.json. A 004.2 tem versão remota 20261029191222 conforme contexto informado; verificar o estado real no preflight futuro. Não executar db push geral: os identificadores remotos anteriores diferem dos nomes locais.
2. Conferir o SHA-256 acima, ausência das colunas/funções novas, owner/ACL/RLS/helpers atuais, FK composta de venues e integridade dos registros legados. Qualquer divergência bloqueia a execução, sem correção automática.
3. Confirmar backup privado recuperável e teste de restauração isolada. Verificar disponibilidade de backup/PITR em vez de presumir recurso do plano. Se necessário, preparar exportação privada de esquema/dados e referências somente com autorização; nunca no Git ou nos logs. Sem recuperação verificável, não aplicar.
4. Combinar janela curta para os locks de ALTER TABLE/validação das constraints. Aplicar **somente este arquivo**, via mecanismo oficial aprovado e em transação única. Sem backfill, novas migrations, seeds, exclusões ou limpeza. Os gates no próprio SQL abortam a transação por drift de ownership/RLS/grants.
5. Registrar o identificador remoto efetivamente emitido, hash e resultado; atualizar o mapeamento somente depois. Verificar colunas nullable sem default, valores originais/timestamps preservados, FK/checks/índice/triggers/owners/ACL e ponteiros nulos. NOTIFY de reload de schema PostgREST só é entregue se a transação confirmar; não muda configuração da API.
6. Executar Advisors de segurança/desempenho, classificar avisos novos e anteriores e conferir cache/descoberta do novo endpoint. Avisos SECURITY DEFINER devem ser avaliados pelo escopo privado, owner limitado e autorização, nunca eliminados por grants/policies permissivos.
7. Com nova autorização para fixtures identificáveis, validar via Auth real e Data API os perfis, versões, rollback, isolamento e agendas. Conservar IDs privados para revisão. A prova local de claims não substitui essa etapa. Não desbloquear telas nem publicar alterações dependentes antes desse aceite.
8. Regenerar oficialmente os tipos do destino validado e preparar a integração do formulário de local principal/agenda em entrega coordenada; nenhuma mudança na develop/main/Production está autorizada por este patch.

## Recuperação

Falha antes do COMMIT reverte todo o DDL/grants/NOTIFY; essa situação foi testada. Após COMMIT, não executar DROP de campos/tabelas, reset, limpeza ou rollback global. Em incidente, suspender a nova operação com plano compensatório revisado e nova autorização: revogar EXECUTE apenas do novo wrapper/implementação e, se necessário, desabilitar somente o novo trigger de atribuição para restaurar temporariamente a criação manual. Manter constraints, colunas e todos os dados/referências; os guards anteriores continuam ativos. Essa contenção muda comportamento e requer avaliação/testes/aceite explícitos, não é executada automaticamente.

Restauração de backup deve ser ensaiada em ambiente isolado e planejada considerando gravações posteriores, jamais sobrescrever o banco atual sem autorização. Não há down migration destrutiva preparada. Nenhum comando de aplicação ou recuperação foi executado remotamente nesta tarefa.

## Arquivos do patch local

- `supabase/migrations/20261113143648_stage0042l_primary_venue.sql`: SQL completo proposto, sem alteração das oito migrations anteriores.
- `tests/database/stage0042l.sql`: 52 asserções funcionais/de autorização/rollback.
- `scripts/test-database.mjs`: preservação de legados, precondições, regressões após nove migrations, concorrência e geração oficial local opcional.
- `tests/database/generated/stage0042l.database.types.ts`: contrato oficial do esquema futuro validado, sem uso pelo aplicativo atual.
- `docs/STAGE0042L.md` e `docs/STAGE0042K.md`: decisões, evidências, limites e operação futura.

Formatação dos arquivos alterados e `git diff --check`: PASS. A checagem global continua com as duas pendências preexistentes em docs/STAGE0032.md e docs/STAGE0032-UI-CHECKLIST.md, fora deste escopo. Nenhuma dessas pendências foi corrigida por alteração incidental.

## Auditoria remota pré-aplicação — 13/11/2026

### Escopo e evidências

Foram usados exclusivamente get_project, list_migrations, get_advisors e SELECTs sobre catálogos/configurações não sensíveis. Nenhuma função de negócio foi invocada remotamente; não foram lidos nomes, endereços, perfis, senhas, cookies ou tokens de usuários. Não houve apply_migration, DDL/DML, SET de configuração, backup novo, restauração, limpeza, backfill ou testes JWT/fixtures remotas. Nenhuma credencial foi solicitada, recuperada ou exibida.

A baseline local desta comparação foi reconstruída em um novo PostgreSQL 17.6 descartável, sem rede/portas, a partir **somente das oito migrations anteriores**, sem aplicar a 004.2-L. Isso produz catálogos comparáveis, não uma alteração no projeto remoto. As suítes de 52 asserções novas/429 testes, concorrência, lint/typecheck/build acima são evidências da preparação anterior e não foram repetidas nesta auditoria documental/metadados. A formatação da documentação atualizada e diff foram conferidos separadamente.

Artefatos sanitizados locais ignorados pelo Git:

- work/stage0042l-preaudit-catalog.json: catálogo remoto dos três objetos diretamente afetados.
- work/stage0042l-preaudit-local-baseline.json: catálogo correspondente das oito migrations locais.
- work/stage0042l-preaudit-comparison.json: comparação normalizada.
- work/stage0042l-preaudit-dependencies.json e work/stage0042l-preaudit-summary.json: dependências e limites de verificação.

Esses arquivos contêm metadados técnicos, não conteúdo das tabelas. Não foram incluídos em commit. A ordenação de algumas agregações difere entre servidores; a comparação normaliza essa ordem sem descartar objetos ou diferenças de definição.

### Projeto e histórico

Projeto confirmado: **plataforma-futebol**, ref **hpbvtqvbtyioqjyelrpb**, região us-west-2, estado **ACTIVE_HEALTHY**. PostgreSQL reportado pelo SQL: **17.11**; metadata da plataforma: 17.11.0.003. A baseline/testes locais usam 17.6, mesma versão principal; essa diferença foi registrada, não ocultada.

| Fonte local                                  | Versão remota confirmada |
| -------------------------------------------- | ------------------------ |
| 20261019205218_identity_tenants              | 20261020150243           |
| 20261019205219_members_scheduling            | 20261020150255           |
| 20261019205220_security_invariants           | 20261020150307           |
| 20261019205221_administration                | 20261020150320           |
| 20261019205222_access_policies               | 20261020150339           |
| 20261020160133_auth_schema_bridge            | 20261020160511           |
| 20261020161609_stage003_identity_workflows   | 20261020162554           |
| 20261027143201_stage0042_group_configuration | 20261029191222           |

As oito entradas coincidem com supabase/development-migrations.json. Os oito arquivos-fonte também conferem com os SHA-256 registrados nesse mapeamento. Não se afirma hash dos statements remotos completos: a conferência adicional foi feita pelos catálogos/definições efetivamente instalados.

**004.2-L não aplicada:** não há groups.primary_venue_id, nenhuma das sete colunas estruturadas em venues, nem as cinco funções novas (wrapper, implementação e três guards). O arquivo local permanece com SHA-256 `d50d527d8c7e5bb806e620ca3b19f8efc10d5125d382a6af70228edc76d38f99`; não foi alterado por esta auditoria.

### Matriz técnica de compatibilidade

| Critério                    | Evidência e resultado                                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projeto, estado e histórico | CONFIRMADOS conforme tabela acima                                                                                                                                                                                                                                                                   |
| Colunas existentes          | 30 definições em groups/venues/group_schedules iguais à baseline, incluindo tipos, defaults e nulabilidade                                                                                                                                                                                          |
| Constraints e dependências  | 25 constraints iguais e validadas; UNIQUE venues(group_id,id) existente; FK composta das agendas e de matches para venues, todas ON DELETE RESTRICT, preservadas                                                                                                                                    |
| Índices                     | Nove definições atuais iguais à baseline; o novo índice parcial do ponteiro ainda não existe e é compatível com a proposta                                                                                                                                                                          |
| Triggers                    | Dez triggers de aplicação iguais e habilitados; triggers internos das constraints consultadas também habilitados                                                                                                                                                                                    |
| RLS/policies                | RLS habilitada nas três tabelas, owner app_executor, FORCE RLS false como no padrão existente; oito policies iguais, com USING/WITH CHECK de vínculo ativo e owner/admin nos writes                                                                                                                 |
| Grants                      | 58 grants de coluna de clientes iguais à baseline; SELECT em nível de tabela para authenticated e somente as colunas de escrita já previstas; sem grants amplos de escrita detectados                                                                                                               |
| Helpers/funções             | 14 hashes MD5 de definições de funções de aplicação/dependência iguais à baseline, incluindo require_manager, group_role, auth_user_id, validate_venue, validate_group_update, enforce_group_owner, guard_group_configuration e os quatro RPCs da Etapa 003                                         |
| Executor e schemas          | app_executor NOLOGIN/NOSUPERUSER/NOBYPASSRLS; sem associação de authenticated/anon ao executor; memberships observadas apenas para postgres; sem USAGE do executor em auth ou SELECT em auth.users; authenticated/anon não têm CREATE em public/private                                             |
| Proteção entre grupos       | Integridade composta já presente e apta a suportar a nova FK (id,primary_venue_id) → venues(group_id,id); RPC proposta valida grupo/vínculo/atividade sob lock e não concede escrita direta nova                                                                                                    |
| RPC nova owner/admin        | Proposta revisada e provada nos testes SQL locais, mas ainda inexistente no remoto. Não foi invocada nem homologada com JWT/Data API nesta auditoria                                                                                                                                                |
| Preservação de legados      | Nenhum comando de alteração remoto executado. Revisão do patch confirma colunas nullable sem default/backfill, CHECK que aceita os novos campos todos nulos, preservação de venues.address e trigger de agenda apenas INSERT. Os UPDATEs estão em corpos de funções, não são executados ao criá-las |
| Concorrência/rollback       | Evidências locais anteriores confirmadas nos logs: CAS de ponteiro e versão, revalidação pós-lock, rollback de DDL/RPC, ausência de órfão e disputa de agenda; 40P01 com UPDATE direto é risco operacional conhecido, não corrupção comprovada                                                      |
| Locks no momento consultado | Zero locks aguardando nas três relações. É uma fotografia, não garantia de ausência de concorrência durante aplicação futura                                                                                                                                                                        |
| Backup/recuperabilidade     | **NÃO COMPROVADOS; bloqueio de aplicação**                                                                                                                                                                                                                                                          |

Nenhum drift estrutural impeditivo foi encontrado nos objetos necessários à migration. Essa comparação não é uma auditoria integral de todos os objetos/produtos do projeto.

### Security Advisor: baseline atual

O Advisor retornou **sete ocorrências WARN e três INFO**. Os achados de banco informam observed_at aproximadamente 2026-11-13T15:19:01Z (**12:19 BRT**). A proteção contra senhas vazadas foi informada no mesmo retorno, sem timestamp próprio. Como a migration não está instalada, todos são baseline pré-aplicação, não resultados gerados pela 004.2-L.

| Achado                                                                                                               | Quantidade           | Avaliação técnica e encaminhamento                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPCs públicos SECURITY DEFINER da Etapa 003: add_guest_once, create_group_once, ensure_my_identity, save_my_identity | 4 WARN authenticated | Risco inerente de APIs privilegiadas; mitigação conferida por owner app_executor, search_path vazio, ACL sem anon e definições iguais ao código auditado. Não se presume aceite administrativo do responsável nem se removem autorizações nesta tarefa                                                                                                                                                                                                                                                                                    |
| rls_auto_enable executável por anon/authenticated                                                                    | 2 WARN               | Objeto preexistente de plataforma, owner postgres, search_path pg_catalog, RETURNS event_trigger, associado ao evento ensure_rls/ddl_command_end. O corpo habilita RLS em CREATE TABLE/CREATE TABLE AS/SELECT INTO de public, com identificadores escapados. Não foi invocado; um grant de EXECUTE não prova que uma função de evento possa ser chamada como RPC comum. Há ACL ampla a revisar administrativamente, mas não foi demonstrada exploração nem vulnerabilidade crítica. A 004.2-L não cria tabelas e não depende de invocá-lo |
| Proteção contra senhas vazadas desabilitada                                                                          | 1 WARN               | Risco moderado de proteção de credenciais; baseline Auth, não causado pelo SQL proposto. Requer decisão/configuração específica do responsável conforme disponibilidade do plano. Não se alterou Auth nem se presume aceite                                                                                                                                                                                                                                                                                                               |
| RLS sem policies: public.group_invitations, private.membership_events, private.mutation_receipts                     | 3 INFO               | Fechamento deliberado, confirmado: anon/authenticated sem SELECT direto. Acesso por funções/fluxos técnicos existentes. Não criar policies permissivas para eliminar o aviso                                                                                                                                                                                                                                                                                                                                                              |

A revisão não demonstrou uma nova vulnerabilidade crítica no patch. Isso não equivale a ausência de riscos no projeto. Os avisos administrativos continuam sujeitos à decisão do responsável; o aceite temporário antigo de dependências de desenvolvimento não se estende automaticamente a esses avisos.

### Performance Advisor: baseline atual

**16 informações unused_index**, sem WARN/ERROR de desempenho nesse retorno. Índices: players_origin_group_idx, players_created_by_idx, groups_created_by_idx, group_invitations_group_idx, group_invitations_created_by_idx, matches_group_date_idx, matches_group_venue_idx, matches_created_by_idx, match_attendance_group_match_status_idx, match_attendance_group_player_idx, membership_events_member_date_idx, membership_events_actor_idx, mutation_receipts_group_idx, group_schedules_group_start_idx, group_pricing_group_start_idx e member_billing_group_player_start_idx.

São estatísticas de uso, não prova de índice desnecessário; não se conhece aqui a janela/reset dessas estatísticas. Não remover índices de FK/tenancy/integridade por baixo uso em homologação. O novo índice parcial do principal apoia o guard de ciclo de vida e deverá ser reavaliado com carga real. Advisors pós-migration não foram simulados nem declarados aprovados.

### Riscos novos da proposta, distintos da baseline dos Advisors

A 004.2-L acrescenta quatro funções privadas SECURITY DEFINER (implementação e guards), um wrapper público SECURITY INVOKER, constraints/índice e triggers. Os controles do patch são owner técnico limitado, search_path vazio, autorização após lock, CAS e ausência de grants novos de escrita direta. O wrapper não é uma nova função pública SECURITY DEFINER. Nada disso já está instalado no remoto; não se inventa um Advisor pós-aplicação nem se presume que não surgirão avisos.

Riscos residuais propostos: aumento de contenção/40P01 nas gravações concorrentes de locais; locks de DDL durante a transação; exposição de uma API de mutação que precisa de homologação JWT real após instalação; e dependência da fronteira esperada de private fora da Data API, ainda não comprovada nesta auditoria. O índice novo pode inicialmente aparecer como unused sem indicar defeito. Esses pontos exigem plano/janela/verificações posteriores, não ampliação de grants ou correção automática fora do escopo.

### Backup e limite de comprovação

A integração Supabase disponível não oferece leitura de backups, histórico de restauração, status de PITR ou pontos recuperáveis. get_project não devolveu esses campos. Nenhum artefato candidato .dump/.backup/_backup_.sql foi localizado na pasta work/ do repositório, em busca somente por nomes; arquivos de credenciais não foram lidos. Não se fez dump de dados, solicitação de token ou tentativa de restauração.

Portanto **não foi possível comprovar existência, recência, retenção, integridade ou restaurabilidade de backup**. Não se afirma que backups não existam. ACTIVE_HEALTHY, versão do banco, histórico de migrations e rollback local **não comprovam recuperação após um COMMIT ou incidente real**. Backup recuperável segue gate obrigatório do plano original; essa ausência de comprovação impede a recomendação de aplicar agora.

O responsável precisa verificar Database → Backups no painel/autorização administrativa adequada, registrar o ponto de recuperação/retenção e comprovar restauração em destino isolado ou procedimento verificável equivalente. Não restaurar sobre o banco atual, não executar reset e não enviar credenciais pelo chat. Se for necessária exportação privada, obter autorização específica e preservar seu conteúdo fora do Git.

### Limite adicional da Data API

A configuração local do repositório expõe public; isso não comprova a configuração hospedada. Não há pgrst.db_schemas registrado nos campos filtrados de configuração de authenticator consultados. As ferramentas usadas não fornecem a configuração efetiva de schemas expostos da API. Assim, **a exclusão efetiva de private da Data API não foi comprovada nesta auditoria**, nem se afirma que esteja exposto.

A implementação proposta continua autorizando explicitamente todo caller, mesmo quando chamada diretamente via SQL, mas a exclusão de private é parte da fronteira arquitetural esperada. Confirmar somente leitura na configuração da Data API antes de concluir o preflight; não alterar schemas/configurações como parte desta auditoria.

### Decisão e condições para nova avaliação

**NÃO APTO para aplicação neste momento.** Bloqueio principal: backup/recuperação não comprovados. Compatibilidade de esquema/grants/dependências está confirmada no escopo auditado; não foi identificada correção obrigatória da migration a executar agora.

Para reavaliar:

1. Apresentar evidência sanitizada de backup recuperável e validação do procedimento de recuperação isolada, incluindo o ponto/retenção e os limites de perda/indisponibilidade aceitos.
2. Confirmar a fronteira de schemas da Data API, especialmente private não exposto, sem fazer alteração administrativa automática.
3. Registrar classificação/decisão do responsável sobre os avisos preexistentes dos Advisors; correções administrativas, se necessárias, devem ser autorizadas separadamente, sem políticas permissivas.
4. Imediatamente antes de qualquer execução autorizada, repetir a conferência do projeto, histórico, hash e gates de ownership/RLS/grants. Combinar janela para locks de ALTER TABLE/CREATE INDEX e limites de espera da transação, sem alterar configuração persistente.
5. Obter autorização específica para aplicar somente o arquivo de SHA-256 acima, em transação única pelo mecanismo oficial. Não executar push geral de migrations por divergência entre identificadores locais/remotos anteriores.
6. Após eventual COMMIT, verificar metadados/ausência de backfill, cache da Data API e Advisors; registrar o identificador real. Somente então executar a matriz com Auth/JWT/Data API em fixtures sintéticas autorizadas e avaliar ativação da interface separadamente.

Falha pré-COMMIT exige ROLLBACK e inspeção, não reparo automático. Recuperação pós-COMMIT deve preservar colunas/dados/referências e depender de plano compensatório autorizado, conforme seção anterior; não executar DROP, limpeza global, backfill ou restauração do banco atual nesta auditoria.

Esta atualização substitui o parecer preliminar condicional para a decisão de execução, preservando as evidências locais anteriores. Não autoriza migration, mudanças de permissões/Auth/Vercel, commit, push, merge ou deploy.
