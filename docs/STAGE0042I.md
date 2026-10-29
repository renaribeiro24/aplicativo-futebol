# Etapa 004.2-I — administração inicial dos grupos

Entrega de 29/10/2026 na `develop`, base `2b7887bccc40b4fe91aa80eeca29e67d0e27d19d`. A publicação Production automática pelo push está expressamente autorizada nesta tarefa. **A homologação Supabase 004.2-H permanece NÃO APTO**; nenhuma migration remota, alteração de RLS/Auth, usuário ou fixture hospedada faz parte desta entrega.

## Tela e navegação

Nova rota privada `/groups/[slug]/settings`, com título Administrar grupo, navegação por âncoras e carregamento próprio. Dashboard e página do grupo exibem o acesso somente para owner/admin. O guard do servidor também exige vínculo ativo owner/admin; player/guest e grupos não autorizados recebem not-found. A autenticação existente continua usando getUser no servidor e o layout privado continua dinâmico, sem cache público de sessão. Erros de leitura são encaminhados à fronteira de erro existente, com opção de tentar novamente e mensagem sanitizada.

A interface reutiliza AppShell/logotipo, tokens, cartões, badges, campos e botões do Design System. Cabeçalho grafite inclusive no tema claro; superfícies respeitam os temas existentes e as ações usam verde elétrico. Uma coluna no celular e campos futuros em duas colunas a partir de sm; listas com quebra de texto e limites explícitos.

## O que realmente funciona

- Leitura e edição de **nome, descrição e fuso horário** do grupo. Descrição vazia é permitida, nome tem até 100 caracteres, descrição até 1.000 e fuso deve ser reconhecido como IANA. Endereço/slug e propriedade não são editados.
- Server Action `updateGroupDetails`: recarrega sessão/grupo/papel, rejeita player/guest, ignora IDs e campos administrativos enviados pelo formulário e emite somente UPDATE das três colunas permitidas. A chave do tenant vem da leitura autorizada pelo slug, nunca de group_id recebido no formulário.
- UPDATE via cliente Supabase SSR do usuário, sob grants por coluna, RLS de manager e trigger de revalidação existentes. Sem service_role, SQL administrativo ou alteração de políticas. O retorno deve conter uma linha atualizada; erro, falha de transporte ou zero linhas não produzem sucesso. Revalidação de dashboard, grupo e settings após confirmação. Escritas concorrentes válidas usam o comportamento existente de última atualização; não foi introduzido controle otimista de versão.
- Leitura dos primeiros 20 integrantes ativos com seus papéis, sem e-mails ou dados privados de contas. Link para a lista paginada e cadastro de convidados já existente. Esta entrega não modifica papéis/status nem transferência de propriedade, mesmo existindo RPCs para esses casos.
- Leitura dos primeiros 50 locais ativos existentes em `venues`, sempre filtrada pelo grupo. Estados vazios reais. `venues` já existe antes da migration 004.2; sua edição foi deliberadamente deixada fora desta primeira interface, não depende tecnicamente da criação dessa tabela.

## Seções em preparação, sem gravação

| Seção                    | Campos preparados                                                                            | Bloqueio                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Agenda semanal           | Dia, horário local, duração, recorrência semanal/quinzenal, primeiro/último encontro e local | group_schedules ainda não homologada/aplicada                                                         |
| Mensalidades e avulsos   | Mensalidade, avulso/convidado, vencimento e início de vigência                               | group_pricing_policies pendente; futura escrita exclusiva de owner                                    |
| Classificação financeira | Integrante e mensalista/avulso                                                               | member_billing_terms pendente; futura escrita de owner/admin                                          |
| Participação             | Texto de regras                                                                              | Não há contrato de persistência/fluxo implementado; não será desbloqueado apenas pela migration 004.2 |

As quatro seções usam fieldset disabled e botões disabled type=button, sem form/action de submissão, valores fictícios ou mensagens de sucesso. Não há sondagem automática de schema, consulta às três tabelas ausentes nem fallback mock em página autenticada. Aplicar a migration futuramente **não habilitará esses formulários sozinho**: contratos, tipos oficiais, ações transacionais e autorização precisam ser implementados/revisados antes. Trocas de vigência não poderão ser duas chamadas REST independentes.

## Verificações e evidências

| Verificação                                                        | Resultado                                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Lint                                                               | PASS                                                                                           |
| Typecheck                                                          | PASS                                                                                           |
| Testes unitários                                                   | 253 PASS em 21 arquivos, incluindo 24 novos                                                    |
| Build local Next.js 16.4.2                                         | PASS; rota settings dinâmica incluída                                                          |
| SQL descartável: edição/persistência de dados gerais e autorização | PASS: 10 novas asserções                                                                       |
| Regressão SQL existente                                            | PASS: 70 asserções anteriores, 109 da 004.2 e 9 corridas de concorrência no runner descartável |
| Layout isolado, desktop/celular, claro/escuro, vazio/preenchido    | 8 PASS; sem overflow horizontal nem erros de console/página                                    |
| Formatação global                                                  | FAIL preexistente somente em docs/STAGE0032.md e docs/STAGE0032-UI-CHECKLIST.md; preservados   |

Os testes novos de ação/guard cobrem owner/admin, player/guest, tenant alheio, campos forjados, input inválido, zero linhas e transporte indisponível sem sucesso falso. Os testes de renderização cobrem estados vazios, falhas de carregamento e todos os controles futuros bloqueados. SDKs são mockados nesses testes unitários; não são prova de persistência remota.

`tests/database/stage0042i.sql`, integrado ao runner, cria somente fixtures descartáveis em transação. Provas de escrita/leitura usam session authorization authenticated; owner/admin persistem alterações, player/guest/owner de outro grupo não alteram linhas, negativas preservam os dados e o owner permanece único. São claims locais de PostgreSQL, **não JWTs emitidos pelo Auth**. O runner não recebe URL remota e destrói somente seu próprio container sem rede/portas.

Evidências locais ignoradas: `work/stage0042i-{lint,typecheck,unit,build,db,format-global}.log`, `work/stage0042i-visual/report.json` e oito screenshots na mesma pasta. O layout visual usa HTML dos componentes com fixtures sintéticas locais, CSS real compilado e um shell de teste; não autentica, não conecta ao Supabase e não representa navegação privada completa. A revisão visual de screenshot móvel escuro foi feita; as oito combinações foram verificadas automaticamente. Nenhuma ferramenta/dependência foi instalada.

## Publicação e conferência do responsável

Após os checks e revisão do diff: commit e push exclusivamente em develop, aguardando o deployment automático Production do SHA publicado. Conferir READY, alias www e HTTPS público; não criar deployment duplicado ou publicar main. Registrar deployment/commit/status e limites na resposta de entrega e em artefato local sanitizado, evitando um segundo push apenas para registrar o resultado e disparar outra publicação.

1. Entrar em https://www.borafute.com.br com uma conta owner/admin e abrir **Administrar** em um dos seus grupos.
2. Conferir nome, descrição, fuso, integrantes/papéis e locais. A lista completa de jogadores continua no link da página do grupo.
3. Em grupo próprio e mediante decisão do responsável, alterar um dado geral, salvar, recarregar settings e conferir também a página do grupo e dashboard. O executor não modificou registros hospedados para testar essa submissão. Verificar mensagem apenas após confirmação e persistência após reload.
4. Como player/guest, conferir ausência do botão e bloqueio ao abrir diretamente `/groups/SEU-SLUG/settings`. Conferir também um slug de grupo sem vínculo; dados privados não devem aparecer.
5. Conferir desktop/celular e temas claro/escuro, teclado e mensagens reais de erro. Agendas, financeiro e regras devem permanecer bloqueados, sem sucesso ao tentar interagir.

Persistência e navegação autenticada no ambiente hospedado permanecem **pendentes de conferência pelo responsável**: não havia sessão técnica disponível neste executor e não foram utilizados usuários reais ou credenciais pessoais. Testes HTTPS públicos/redirects não substituem essa homologação. A entrega não altera o parecer NÃO APTO da 004.2-H.
