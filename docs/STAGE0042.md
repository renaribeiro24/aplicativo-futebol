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
