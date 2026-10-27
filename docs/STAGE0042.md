# Etapa 004.2 — configuração de grupos: banco

Estado em 27/10/2026: implementação SQL preparada para desenvolvimento na `develop`, a partir de `2148cd1a53033f931ed651d6a22792e6b4974651`. **Nenhuma migration aplicada ao Supabase remoto, nenhum deploy ou alteração de dados existentes.** A Etapa 003.2 foi encerrada tecnicamente com ressalvas pelo responsável; seu aceite não autoriza produção e suas evidências históricas não foram repetidas nesta tarefa.

## Entrega e compatibilidade

Migration completa: [20261027143201_stage0042_group_configuration.sql](../supabase/migrations/20261027143201_stage0042_group_configuration.sql), criada por `supabase migration new stage0042_group_configuration`, CLI 2.121.0. A configuração de cache local da CLI usa `SUPABASE_HOME` em `work/cli-home`, sem ler credenciais. São oito migrations locais; **somente as sete anteriores constam do mapeamento remoto**. Não acrescentar esta ao manifesto remoto antes de aplicação autorizada.

Três tabelas novas; sem seed, backfill ou alteração das migrations aplicadas. Nenhum preço, classificação financeira ou agenda é atribuído aos grupos existentes. As tabelas de encontros, presenças, perfis e jogadores continuam com seus contratos. Não há nova interface, gerador de encontros, RPC pública, cobrança, pagamento, caixa ou campeonato. Os quatro papéis continuam owner/admin/player/guest; não foi criado papel administrativo adicional.

## Modelagem

- `group_schedules`: UUID, FK de grupo e FK composta `(group_id,venue_id)` para `venues(group_id,id)`, local opcional. `weekday`: **0 domingo a 6 sábado** (PostgreSQL DOW). `starts_at_local`: `time without time zone`, de 00:00 até antes de 24:00; duração inteira positiva, inclusive quando atravessa meia-noite. `starts_on` deve cair no weekday e é a **primeira ocorrência/data âncora**, inclusive para quinzenal. Semanas válidas têm distância em dias múltipla de `7 * interval_weeks` em relação à âncora; weekly exige 1, biweekly exige 2. `ends_on` é inclusiva e não antecede a âncora. Datas finitas, flag ativa; múltiplas regras por grupo, inclusive horários sobrepostos (não foi especificada exclusividade). O fuso vem de `groups.timezone`, sem duplicação. Uma futura geração deverá resolver horários ambíguos/inexistentes de DST, usando datas locais; não somar 168/336 horas a timestamps UTC.
- `group_pricing_policies`: preços inteiros em centavos, explicitamente configurados. Cada modalidade habilitada exige valor não negativo; mensalidade exige também dia de 1 a 31. Modalidade desabilitada exige respectivos campos NULL. Zero é permitido apenas como decisão explícita, sem default financeiro; ambas desabilitadas são uma política explícita sem modalidades. Convidados utilizam o preço avulso, sem coluna de preço especial. `due_day` 29–31 deverá ser limitado ao último dia do mês pelo módulo futuro de cobrança, com testes próprios; **nenhum vencimento ou cobrança é calculado agora**.
- `member_billing_terms`: FK composta `(group_id,player_id)` para o vínculo único `group_members(group_id,player_id)`, preservando também a FK de grupo. Valores monthly/casual. Novo vínculo financeiro ou alteração de classificação/início exige integrante ativo e jogador não arquivado. Histórico pode ser encerrado no futuro mesmo após saída/suspensão. Guest só admite casual; não é criada qualquer cobrança.

Preços e classificações usam **intervalos `[effective_from,effective_until)`**: início inclusivo, fim exclusivo, NULL sem limite superior, fim estritamente posterior ao início. Intervalos adjacentes são permitidos. Datas não aceitam infinity. Exclusões GiST impedem sobreposição por grupo, ou por `(grupo,jogador)`, inclusive entre transações. Dependem de `btree_gist` no schema `extensions`; migration não move extensões existentes. Confirmar disponibilidade/schema e privilégios de instalação no ambiente alvo antes da aplicação. Índices B-tree cobrem grupo/início, grupo/local e grupo/jogador/início para consultas ordenadas e FKs; os GiST atendem as exclusões.

## Autorização implementada no banco

Todos os acessos exigem vínculo ativo reconhecido por `private.group_role`, incluindo grupo e jogador não arquivados. A chave do tenant fornecida pelo cliente nunca concede acesso por si só.

| Operação                                         | owner                     | admin          | player           | guest autenticado ativo | Sem vínculo / anon |
| ------------------------------------------------ | ------------------------- | -------------- | ---------------- | ----------------------- | ------------------ |
| Consultar agendas do grupo                       | Sim                       | Sim            | Sim              | Sim                     | Não                |
| Inserir/editar/desativar agendas                 | Sim                       | Sim            | Não              | Não                     | Não                |
| Consultar políticas de preço do grupo            | Sim                       | Sim            | Sim              | Sim                     | Não                |
| Inserir/editar preço, vencimento e vigência      | Sim, sujeito ao histórico | Não            | Não              | Não                     | Não                |
| Consultar classificações                         | Todas do grupo            | Todas do grupo | Somente próprias | Somente próprias        | Não                |
| Inserir/editar classificação financeira          | Sim                       | Sim            | Não              | Não                     | Não                |
| Excluir registros / transferir tenant ou jogador | Não                       | Não            | Não              | Não                     | Não                |

Guest sem conta não dispõe de sessão: seu acesso continua sendo nenhum. Para guest autenticado, agenda e tabela de preços do **próprio grupo ativo** são informações autorizadas; classificações de terceiros não são expostas. Não há acesso por mero convite ou participação histórica. Regras futuras de divulgação de encontros específicos podem restringir essa leitura, mediante nova revisão.

RLS habilitada na criação, sem grants a anon/service_role; policies de UPDATE possuem USING e WITH CHECK. Grants por coluna vedam alteração de ID, tenant, jogador e timestamps, além de DELETE/TRUNCATE. Dois triggers privados SECURITY DEFINER, de owner técnico `app_executor` NOLOGIN/NOBYPASSRLS e `search_path=''`, sem EXECUTE a clientes, impõem invariantes que RLS isolada não garante. Não há nova função pública privilegiada. `private.touch_updated_at` existente atualiza timestamps.

O guard obtém o mesmo lock de grupo usado pelas RPCs existentes **antes de revalidar o papel**, evitando escrita com papel antigo após aguardar transferência/rebaixamento. A leitura interna privilegiada só verifica o grupo/local/vínculo alvo; não retorna dados nem aceita identidade de outro usuário. O owner técnico passa a possuir também as três novas tabelas, seguindo o padrão existente; nenhum cliente recebe esse papel.

### Preservação de histórico

A data corrente é calculada com relógio do banco no fuso do grupo. INSERT retroativo é rejeitado. Versões futuras podem ter valores/classificação/início alterados, respeitando exclusão. Quando uma versão começa (inclusive no próprio dia), seu conteúdo e início ficam imutáveis; só seu fim pode ser alterado, obrigatoriamente para data futura. Versão já encerrada não pode ser reaberta/editada. Não há DELETE ou cancelamento físico de versão futura nesta entrega.

Para alterar uma política vigente: **em uma transação**, encerrar a versão atual na data futura D e inserir a nova com início D. O mesmo vale para mudança mensalista/avulso. Fazer fechamento antes do INSERT, pois as exclusões não são diferidas. Falha deve reverter a transação inteira; não publicar uma interface que faça duas chamadas HTTP independentes para isso. Uma RPC futura poderá encapsular esse caso; não foi criada API adicional agora.

O novo trigger `members_guest_billing_guard` é a única adição a uma tabela existente: antes de mudar papel para guest, recusa classificações monthly atuais/futuras. Justificativa: sem essa verificação, uma mudança de papel contornaria a regra guest=casual. Não altera policies, grants, funções existentes ou linhas; regressões de gerenciamento/propriedade são executadas. Uma classificação monthly existente deve terminar e deixar de vigorar antes dessa mudança de papel; não há bypass administrativo implícito nem perda de histórico.

## Validação local

Resultados desta execução (27/10/2026):

| Verificação                                                                                                    | Resultado                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Aplicação das oito migrations em PostgreSQL 17.6 descartável                                                   | PASS                                                                                     |
| Novas asserções SQL da Etapa 004.2                                                                             | 109 PASS                                                                                 |
| Asserções SQL de segurança anteriores                                                                          | 70 PASS                                                                                  |
| Regressões de bridge, grupos, convites, convidados, perfil e idempotência                                      | PASS                                                                                     |
| Concorrência nova: preços sobrepostos, classificações sobrepostas e admin rebaixado durante espera             | 3 PASS                                                                                   |
| Corridas anteriores: vaga, convidado idempotente, grupo idempotente, slug, grupos independentes, transferência | 6 PASS                                                                                   |
| Lint                                                                                                           | PASS                                                                                     |
| Typecheck                                                                                                      | PASS                                                                                     |
| Vitest                                                                                                         | 126 testes PASS em 15 arquivos                                                           |
| Build de produção local                                                                                        | PASS, sem publicação                                                                     |
| Formatação dos arquivos JS/Markdown alterados                                                                  | PASS                                                                                     |
| Formatação global                                                                                              | FAIL preexistente em docs/STAGE0032.md e docs/STAGE0032-UI-CHECKLIST.md, não modificados |
| Revisão git diff --check                                                                                       | PASS                                                                                     |
| Supabase completo / novos testes HTTP JWT / advisors                                                           | Não executados; validação posterior                                                      |

Dependências exatas reaproveitadas da instalação local anterior; package-lock.json comparado e idêntico, sem atualização de dependências nesta tarefa. Logs locais ignorados em work/{db,lint,typecheck,unit,build,format}-stage0042.log. As sete migrations anteriores, manifesto de versões remotas, código da aplicação e package/lock foram conferidos sem diff. Nenhum commit ou push realizado nesta entrega.

O runner `npm run db:test` usa um container PostgreSQL 17.6 fixado por digest, sem rede/portas, com descarte apenas desse container. Todas as fixtures são sintéticas; não usa URL de banco fornecida pelo usuário e não conhece grupos reais. `tests/database/stage0042.sql` separa preparação privilegiada de provas com session_user/current_user authenticated/anon. Duas provas adicionais de trigger sob app_executor são explicitamente defesa em profundidade, não prova de RLS de cliente. Para preparar duas linhas históricas de teste, só os guards das novas tabelas são suspensos momentaneamente no container descartável, antes das sessões de cliente; isso nunca é migration ou instrução remota.

Cobertura: owner/admin criam/editam agenda; player/guest negados; apenas owner escreve preços; player/guest leem somente suas classificações; isolamento, anon e suspensão; campos imutáveis, local de outro grupo/arquivado, integrante de outro tenant, duração/datas/recorrência, preços e NULLs/vencimento inválidos, intervalos adjacentes/sobrepostos, retroatividade/histórico, guest=casual e mudanças de papel. Corridas concorrentes de preço/classificação exigem um vencedor; rebaixamento de admin durante espera do lock impede INSERT. Regressões de identidade, grupos, convidados, convites, vínculo/owner, idempotência e seis corridas anteriores permanecem no runner.

Os testes SQL usam claims locais para exercitar PostgreSQL/RLS, **não JWT real nem Supabase Auth HTTP**. Não foram repetidos testes reais da Etapa 003.2. A pilha Supabase completa, default privileges/event triggers hospedados, advisors e PostgREST das novas tabelas continuam para homologação posterior. Tipos `Database` existentes não foram fabricados ou ampliados manualmente; gerar oficialmente a partir de instância local completa após aplicar o schema, antes de integrar novas consultas na aplicação.

## Homologação e aplicação posterior

1. Revisar este SQL e os testes; conferir PostgreSQL/extensão btree_gist em extensions, helpers e ownership/ACLs existentes.
2. Em **Supabase local descartável**, aplicar migrations pelo procedimento local do repositório, conferir lint/advisors e gerar tipos oficiais. Nenhum comando local deve receber URL remota.
3. Testar novas tabelas pela Data API com JWTs reais de contas técnicas e vários papéis, confirmando inclusive negativas sem mutação; isso ainda não foi executado.
4. Antes de qualquer aplicação remota, obter autorização específica, conferir o mapeamento das sete migrations anteriores em `supabase/development-migrations.json` e revisar backup/rollback. Aplicar exclusivamente a oitava; não usar `db push` cegamente contra versões locais/remotas divergentes. Não editar o manifesto como se a aplicação já tivesse acontecido.
5. Revisar posteriormente DST, geração de encontros, atomicidade da interface de troca de versões, clamp do vencimento e eventual cancelamento de versão futura. Todos estão fora desta primeira migration.

Nenhum resultado local significa que a migration foi aplicada ou homologada no Supabase remoto. Sem merge na main, promoção, deploy, alteração de domínio/DNS/Resend/Auth ou limpeza de dados. Riscos temporários/ressalvas da Etapa 003.2 continuam sujeitos às decisões anteriores, sem ampliação de aceite.

## Documentação consultada

- Supabase: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [privilégios por coluna](https://supabase.com/docs/guides/database/postgres/column-level-security), consultados por MCP oficial; políticas de UPDATE não substituem proteção de colunas.
- CLI 2.121.0: ajuda de migration new consultada e comando de geração executado localmente.
- A leitura direta de https://supabase.com/changelog.md foi recusada pelo proxy (CONNECT 403); nenhum contorno foi tentado. A revisão não certifica mudanças de plataforma não acessíveis por esse índice.

## Etapa 004.2-H — tentativa de homologação Supabase local (27/10/2026)

**Resultado: BLOQUEADA POR INFRAESTRUTURA; homologação completa NÃO CONCLUÍDA.** Trabalho na develop, base `e01006c197bf1232b6f2212258372019cb00554b`, checkout inicialmente limpo e sincronizado. As oito migrations estão presentes. Nenhuma foi aplicada ao Supabase hospedado, nenhum usuário remoto foi criado e nenhuma evidência da Etapa 003.2 foi modificada. Os resultados SQL descartáveis da seção anterior continuam válidos apenas no escopo original; não foram convertidos em testes de Auth/Data API.

### Ambiente, tentativa e evidência

- Node.js 24.19.0, npm 11.9.0, Supabase CLI 2.121.0 e Docker Engine 28.4.0, daemon local `unix:///var/run/docker.sock`.
- Configuração existente: PostgreSQL major 17, API expondo apenas public, private fora da API, migrations habilitadas e seed desabilitado. Nenhuma configuração foi alterada. A configuração local preexistente tem confirmação de e-mail desabilitada; isso não foi modificado e não equivale a validação do fluxo hospedado de confirmação.
- CLI executada com SUPABASE_HOME em work/cli-home para armazenar seu cache somente no workspace. A chamada inicial sem esse seletor não conseguiu escrever seu arquivo de telemetria no home somente leitura; não é defeito de schema e foi resolvida localmente pelo seletor já utilizado na Etapa 004.2.
- O Docker respondeu normalmente e não havia containers/volumes de uma instância Supabase anterior. Executado `supabase start` com o daemon local explicitamente selecionado, sem --linked, project-ref, URL de banco ou credenciais remotas. Saída mantida em arquivo ignorado, não impressa integralmente.
- O download das imagens falhou em `https://public.ecr.aws/v2/` com **Forbidden**. O registry não consta da lista permitida da política de rede restrita deste executor. Após recusas reiteradas internas da CLI, somente esse processo de start foi interrompido com SIGINT (saída 130), evitando repetir downloads recusados. Nenhum serviço foi iniciado; não houve erro SQL ou reprovação de autorização da aplicação.
- Tags solicitadas, **não versões homologadas**: postgres 17.11.0.004, gotrue v2.197.0 e postgrest v16.4. Não foi possível obter uma versão executada do PostgreSQL/Auth/Data API da pilha completa.
- Registro sanitizado produzido às **11:55:34 de 27/10/2026, America/Sao_Paulo** (14:55:34 UTC), em work/stage0042h-preflight.json. Log: work/stage0042h-start.log; SHA-256 `46e7be327f4529511793c121126d90100b562ea313aa6f11cd2a6cc871a9c8ca`. Horário é do registro de diagnóstico, não comprovação de início dos testes HTTP, que não ocorreram. Artefatos ignorados não são publicados no Git.
- Nenhum bypass de proxy, troca de registry para contornar a política ou uso do banco remoto como alternativa. Nenhuma credencial local/real foi publicada.

### Matriz de homologação desta tentativa

| Critério                                                                    | Resultado     | Evidência / limitação                                                                      |
| --------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| Branch develop, estado remoto e oito arquivos de migration                  | PASS          | Checkout e fetch; zero divergência na preparação                                           |
| CLI e Docker local disponíveis                                              | PASS          | Versões e socket local verificados                                                         |
| Início da instância Supabase completa                                       | FAIL          | Registry recusado; falha de infraestrutura antes do provisionamento                        |
| Aplicação das oito migrations na pilha completa                             | NÃO EXECUTADO | Banco Supabase local não iniciou                                                           |
| btree_gist/extensions, ownership, ACLs, FKs e integridade na pilha completa | NÃO EXECUTADO | Evidências anteriores são do PostgreSQL descartável, não desta instância                   |
| RLS e funções privadas sob Supabase completo                                | NÃO EXECUTADO | Sem instância local disponível                                                             |
| Advisors de segurança e desempenho                                          | NÃO EXECUTADO | Nenhum achado novo/preexistente foi obtido nesta tentativa; isso não significa zero avisos |
| Geração oficial dos tipos TypeScript locais                                 | NÃO EXECUTADO | Arquivo existente preservado; nenhum tipo inventado ou substituído por saída vazia         |
| Auth local e JWTs reais owner/admin/player/guest/sem vínculo                | NÃO EXECUTADO | Zero contas ou tokens criados                                                              |
| Data API: leituras, escritas e negativas por papel                          | NÃO EXECUTADO | Sem Auth/PostgREST locais                                                                  |
| Isolamento, preços exclusivos de owner e classificação individual           | NÃO EXECUTADO | Exige nova evidência HTTP; SQL anterior não substitui                                      |
| Sobreposição, histórico e troca atômica sob pilha completa                  | NÃO EXECUTADO | Nenhuma nova operação financeira ou fixture                                                |
| Regressões HTTP de perfil, grupos, convidados e gerenciamento de membros    | NÃO EXECUTADO | Não reutilizar o domínio público para esta homologação local                               |

Não executar advisors com --linked ou consultar o projeto hospedado para preencher esta matriz. Os avisos históricos do Advisor remoto continuam no relatório da Etapa 003.2; não se pode presumir que correspondam aos avisos de uma pilha local não iniciada. O aviso de CLI **[inbucket] deprecated, use [local_smtp]** foi observado na configuração existente: é compatibilidade futura da CLI, não um resultado de Security Advisor e não foi corrigido por alteração administrativa.

### Verificações do repositório nesta rodada

| Verificação do repositório       | Resultado desta rodada                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| npm run lint                     | PASS                                                                                               |
| npm run typecheck                | PASS                                                                                               |
| npm test                         | PASS: 126 testes em 15 arquivos                                                                    |
| npm run build                    | PASS: build local Next.js 16.4.2, sem publicação                                                   |
| Formatação do documento alterado | PASS                                                                                               |
| npm run format:check global      | FAIL: somente docs/STAGE0032.md e docs/STAGE0032-UI-CHECKLIST.md, falhas preexistentes preservadas |
| git diff --check                 | PASS                                                                                               |

Logs ignorados: work/stage0042h-{lint,typecheck,unit,build,format}.log. Essas verificações não desbloqueiam os critérios HTTP e da pilha completa acima. Não foi repetida a suíte PostgreSQL descartável nesta rodada: os resultados anteriores permanecem históricos, sem nova atribuição à pilha Supabase. Sem alteração de SQL, código de aplicação, dependências, tipos ou configurações; alteração somente neste documento.

### Retomada segura em ambiente com suporte local

No Codespaces ou máquina de desenvolvimento com Docker e acesso autorizado ao registry oficial:

1. Sincronizar develop preservando trabalho local. Conferir CLI 2.121.0, Docker, oito migrations, configuração e ausência de ligação/destino remoto no comando. Inventariar instâncias locais existentes antes de iniciar; **não executar reset, remover volumes ou sobrescrever secrets** de uma instância preexistente.
2. Em instância local nova e exclusiva desta homologação, executar `npx supabase start`. A criação nova aplica as migrations automaticamente; registrar os oito arquivos aplicados. Não substituir esta etapa por testes SQL simulados. Se existir banco local com dados não descartáveis, preparar instância separada antes de qualquer reset.
3. Conferir catálogo/ACLs, constraints, triggers e versão de btree_gist; testar que private não está exposto e que os dois novos trigger guards não possuem EXECUTE de clientes. Comparar advisors antes/depois da oitava migration em instâncias descartáveis separadas, sem alterar as migrations compartilhadas, para distinguir achados novos/preexistentes.
4. Executar `npx supabase db advisors --local --type all --level info --fail-on none --output-format json`, mantendo o relatório completo local e publicando apenas resumo sanitizado. Executar também `npm run db:lint:local`.
5. Executar `npm run db:types`, revisar o diff gerado oficialmente e rodar validação de TypeScript antes de publicar os tipos. O script existente rejeita argumentos remotos.
6. Criar exclusivamente no Auth **local** cinco contas sintéticas distintas (owner/admin/player/guest/sem vínculo), autenticar normalmente e verificar identidade por getUser. Preparar vínculos somente em grupos sintéticos locais pelos mecanismos existentes; eventual preparação privilegiada deve ficar separada das provas de autorização. Nas provas HTTP usar chave publicável local e JWT do respectivo usuário, nunca service_role para representar cliente.
7. Executar e registrar matriz HTTP permitida/negada, linhas realmente visíveis/alteradas, isolamento entre dois grupos, preços imutáveis para admin/player/guest, classificações próprias/terceiras, tentativas de reatribuição, sobreposições e histórico. Conferir integridade após negativas. Regressões devem cobrir RPCs existentes de perfil/grupos/convidados/convites/vínculos e owner único, sem ampliar permissões.
8. Para troca de vigência, comprovar fechamento e inserção em **uma transação** com rollback em erro, inclusive sob contexto não privilegiado. Não tratar duas chamadas Data API independentes como operação atômica. A Etapa 004.2 ainda não fornece RPC pública de substituição; não inventar que esse fluxo já está exposto pela API.
9. Rodar lint, typecheck, testes e build; registrar versões, commit, origem loopback, run e artefatos sanitizados. Não imprimir status/ambiente completo com chaves, JWTs ou senhas. Nenhum teste deste roteiro deve receber o ref hospedado ou domínio público.

**Parecer: a Etapa 004.2 ainda NÃO está tecnicamente pronta para solicitar aplicação remota com homologação completa.** Permanecem impeditivos de evidência: Supabase local completo, advisors, tipos oficiais e Auth/Data API com JWT real. A implementação SQL permanece preparada e já testada no PostgreSQL descartável anterior, mas não foi homologada nesta pilha. Retomar essas verificações em ambiente apropriado; não aplicar remotamente para resolver a limitação local. Sem merge, deploy ou ampliação do aceite de riscos anteriores.
