# Etapa 004.2-K — Configurações operacionais

## Estado em 10/11/2026

Implementação local na branch `feat/stage0042-operational`, baseada em `cb99ebfccc12e1ee2b0a0d6ceeabab6a518f2b8c` (histórico do runner HTTP preservado). A comparação inicial de src/, package.json e package-lock.json com a develop remota não apresentou diferenças. Sem push para develop, deploy ou alteração no Supabase. A transferência desta branch de trabalho ao GitHub foi autorizada para homologação no Codespaces. Publicação em develop/Production continua sem autorização.

### Evidência de homologação do banco

O responsável informou execução PASS/completed, 161 checkpoints aprovados e zero falhas, com fixtures preservadas. Manifesto no Codespaces: `work/stage0042-http-8093c964-36c5-4e15-8e6a-30f108b0b246.json`. Este executor não teve acesso ao arquivo e **não o conferiu diretamente**. A homologação 004.2-H é registrada como aprovada conforme relato do responsável, com essa ressalva de procedência; não equivale à homologação das novas telas e Server Actions.

## Interface e persistência

Rota existente ampliada: `/groups/[slug]/settings`, acessível pelos links existentes do dashboard/grupo. Componentes, formulários, cartões e tokens da marca reutilizados.

- Agenda: cadastrar, editar, desativar e consultar; domingo=0, sábado=6; horário local no fuso do grupo; recorrência semanal/quinzenal derivando intervalo 1/2; primeira ocorrência como referência; duração positiva; local opcional do mesmo grupo. Não gera partidas.
- Locais: cadastro real de nome e endereço usando a tabela venues e permissões já existentes. Lista limitada a 1.000 locais ativos, com aviso quando alcançada.
- Preços: proprietário habilita mensalidade/avulso, informa valores explícitos em centavos, vencimento e vigência. Sem valores automáticos; convidado usa avulso. Histórico, edição de versões futuras e encerramento futuro explícito. Nenhuma cobrança ou pagamento.
- Classificação: proprietário/admin cadastram mensalista/avulso para vínculo ativo; convidados somente avulsos. Histórico por integrante, edição futura e encerramento explícito. Seleção usa a página atual de integrantes (20 registros); listas de agendas, preços e classificações têm paginação de 10 registros.
- Dados gerais existentes preservados. Regras de participação continuam desabilitadas e identificadas como preparação.

## Permissões

| Operação                                       | Owner                                          | Admin          | Player/guest/externo |
| ---------------------------------------------- | ---------------------------------------------- | -------------- | -------------------- |
| Acessar administração                          | Sim                                            | Sim            | Não                  |
| Agenda e locais                                | Criar/editar/desativar agenda; cadastrar local | Igual ao owner | Não                  |
| Consultar histórico de preços na administração | Sim                                            | Sim            | Não por esta rota    |
| Criar/editar preço/vencimento/vigência         | Sim, conforme histórico                        | Não            | Não                  |
| Classificação financeira                       | Criar/editar conforme histórico                | Igual ao owner | Não por esta rota    |

Cada ação recarrega a identidade e o vínculo ativo pelo servidor. Identificadores do grupo vêm da rota autorizada; IDs de registros são validados e filtrados pelo mesmo grupo. Nunca se aceita group_id, papel ou preço em centavos fornecido para substituir valores derivados no servidor. Atualização de classificação preserva player_id original. RLS, grants, locks e triggers existentes continuam como última barreira, inclusive em mudanças concorrentes de papel/vigência. Redirect/notFound do Next.js são preservados. Sucesso exige retorno confirmado de registro, seguido de revalidação; falha/zero linhas não geram sucesso. Logs não recebem credenciais nem conteúdo de erros privados.

Tipos de banco regenerados oficialmente via Supabase MCP (introspecção somente leitura), sem preencher Database manualmente e sem aplicar SQL.

## Limite de sucessão financeira

Não há RPC pública transacional existente para encerrar versão vigente e inserir sucessora atomicamente. Por isso, **não foi implementada troca atômica de preço/classificação vigente**. A interface permite cadastro em intervalo livre, edição de versão futura e encerramento independente, com aviso explícito de que não cria substituição. Conteúdo iniciado e histórico encerrado permanecem imutáveis. Sobreposição é rejeitada pelo banco e comunicada sem afirmar substituição.

Não usar dois pedidos HTTP como se fossem uma transação. Uma operação de sucessão atômica dependerá de proposta e revisão específica de banco, fora desta entrega. O responsável confirmou nesta transferência que o encerramento independente deve ser preservado, sem substituição automática nesta entrega. Não alterar preços atuais por reescrita nem orientar encerramento seguido de cadastro como fluxo seguro de troca.

## Validações locais

- 408 testes automatizados em 27 arquivos: PASS. Incluem validação monetária exata, datas/fuso, recorrência, papéis, acesso cruzado, imutabilidade, respostas de zero linhas, erros PostgREST e transporte, composição de requisições usando SDK real com fetch simulado e renderização por papel.
- Integração HTTP local com fetch simulado: verifica payloads/filtros do SDK e erros; **não representa JWT real ou autorização remota**.
- `npm run db:test`: PASS em PostgreSQL 17.6 descartável sem rede/portas. Oito migrations, 70 asserções de segurança, 109 da 004.2, 10 de administração existente, regressões de identidade/grupos/convidados e testes de concorrência. Claims SQL locais não são JWTs reais. Não executou SQL remoto.
- Lint, typecheck e build: PASS (logs locais em work/stage0042k-*.log).
- Layout isolado sintético em Chromium: 8 cenários PASS (owner/admin × desktop 1440×900/celular 390×844 × claro/escuro), formulários expandidos, sem overflow horizontal e sem erros de página/console; controles de preço ausentes para admin. Relatório e imagens ignorados pelo Git em `work/stage0042k-visual/`. Não é navegação autenticada na aplicação nem teste de submissão real. Capturas móvel escura (owner) e desktop clara (admin) inspecionadas visualmente.
- Formatação dos arquivos alterados: PASS. `npm run format:check` global falhou exclusivamente nas duas pendências documentais preexistentes em docs/STAGE0032.md e docs/STAGE0032-UI-CHECKLIST.md; esses arquivos não foram alterados. `git diff --check`: PASS.

## Pendências e publicação

1. Conferir diretamente o manifesto HTTP no Codespaces para completar a rastreabilidade da 004.2-H.
2. Validar Server Actions e telas autenticadas de owner/admin em ambiente com conectividade e contas técnicas. Este executor não dispõe das credenciais do Codespaces; não repetiu autenticação nem criou fixtures remotas.
3. Em grupo sintético autorizado, conferir cadastro/edição/desativação de agenda, cadastro de local, política futura em intervalo livre, classificação futura e persistência após recarregar. Verificar erro de sobreposição sem alteração da versão anterior e ausência de formulários de preço para admin. Conferir rejeição de player/guest, sessões expiradas, datas e teclado em celular/desktop. Não modificar grupos reais.
4. Preservar o encerramento independente, conforme decisão do responsável; planejar sucessão atômica separadamente se necessária.
5. Após revisão, autorizar transferência do diff para develop preservando seu histórico. Essa branch aciona Production automaticamente; nenhum push ou deploy foi feito nesta tarefa. Conferir commit/deployment/domínio após eventual publicação autorizada, sem presumir acompanhamento do alias.

Nenhuma migration, RLS, grant, função, configuração Auth, DNS, Vercel ou dado preexistente alterado. Sem bibliotecas adicionais, cobrança, pagamentos, Pix ou geração de partidas. Não há liberação presumida para produção.

## Arquivos desta entrega

- `src/app/(protected)/groups/[slug]/settings/page.tsx`: integração, locais e paginação de integrantes.
- `src/features/groups/operations/actions.ts`: ações autenticadas com validação, autorização e confirmação de persistência.
- `src/features/groups/operations/validation.ts`: regras de datas, valores, recorrência e erros sanitizados.
- `src/features/groups/operations/forms.tsx`: formulários operacionais.
- `src/features/groups/operations/panel.tsx`: leitura, histórico, estados vazios e paginação.
- `src/features/groups/operations/participation.tsx`: seção ainda indisponível, sem ação de gravação.
- `src/features/groups/pending-configuration.tsx`: removido; substituído pelos componentes acima.
- `src/types/database.types.ts` e `src/types/README.md`: contrato oficial e procedência.
- `tests/group-operations-actions.test.ts`, `tests/group-operations-validation.test.ts`, `tests/group-operations-integration.test.ts`, `tests/group-operations-panel.test.ts`: cobertura nova.
- `tests/group-settings-page.test.ts`: regressão da página existente atualizada.
- `docs/STAGE0042.md` e `docs/STAGE0042K.md`: evidências e entrega.

Os artefatos locais em work/ permanecem ignorados; nenhum manifesto privado, screenshot, credencial ou fixture será incluído no diff para publicação. A transferência autorizada inclui somente os 16 arquivos listados; o SHA publicado será informado na entrega, sem commit adicional apenas para gravar seu próprio hash.

## Transferência autorizada para Codespaces — 10/11/2026

Branch remota de destino: `feat/stage0042-operational`, inexistente na consulta anterior ao push. develop e main não serão atualizadas. Revisão do diff: somente componentes, ações, tipos oficiais, testes sintéticos em código e documentação listados acima; sem segredos, manifestos privados, dados/fixtures reais, migrations ou alterações administrativas. Os testes contêm exclusivamente constantes sintéticas e transporte simulado, sem exportar fixtures do banco. Nenhum comando de deploy ou merge será executado. A integração Git da Vercel pode processar pushes de branches conforme sua configuração já existente; esta transferência não modifica essa configuração nem promove qualquer versão para Production.

Revalidação para transferência: 408/408 testes em 27 arquivos, lint, typecheck e build PASS. Os resultados SQL e visuais da seção anterior pertencem à implementação anterior; não foram executados novamente para este push. Formatação dos arquivos alterados e `git diff --check`: PASS; duas falhas globais preexistentes da Etapa 003.2 permanecem fora do escopo.

### Preparação no Codespaces

Execute cada comando somente se o anterior terminar com sucesso. Não use reset, clean ou force. A primeira verificação deve mostrar árvore limpa; se houver alterações, preserve-as e interrompa a troca de branch para avaliar separadamente. A pasta ignorada work/ e os arquivos locais de configuração devem ser preservados.

```bash
cd /workspaces/aplicativo-futebol
git status -sb
git fetch origin refs/heads/feat/stage0042-operational:refs/remotes/origin/feat/stage0042-operational
git switch --track origin/feat/stage0042-operational
git branch --show-current
git log -1 --format='%H %s'
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm run dev
```

Se a branch local já existir, substitua apenas o comando `git switch --track` por `git switch feat/stage0042-operational` e depois `git merge --ff-only origin/feat/stage0042-operational`; havendo divergência, pare sem rebase/reset. Confira o SHA informado na entrega antes de iniciar a homologação.

O servidor deve usar a porta 3000 e a URL HTTPS encaminhada do Codespaces, não o domínio oficial (que pode servir outra versão). Utilize a configuração local ignorada/secrets já existentes para `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL`; nunca cole seus valores em relatórios. Não substitua arquivos privados nem altere Auth/URLs remotas para executar este roteiro. Faça login com contas técnicas já confirmadas pelo fluxo normal; não crie contas novas nesta transferência. A exceção de Server Actions existente é restrita ao dev server/Codespaces/porta 3000 e não foi modificada.

O runner HTTP da 004.2 não é necessário para validar esta entrega e ainda restringe branches a develop/test/stage0042-http. Não o execute nesta branch, não remova sua proteção e não repita a matriz completa já aprovada para validar somente a UI.

### Matriz de homologação funcional — execução pendente

Use exclusivamente grupos sintéticos autorizados e contas técnicas owner/admin/player/guest, com segundo grupo sintético para isolamento. Confira previamente os vínculos e registre somente identificadores técnicos necessários em manifesto privado ignorado; não promova contas nem modifique vínculos para facilitar o teste. Se faltar perfil ou grupo adequado, interrompa o cenário dependente. Não use 4ª Força, Grupo Teste 2 ou grupos reais.

| Cenário                | Procedimento e resultado esperado                                                                                                                                                                                                                     | Estado   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Persistência de agenda | Owner cadastra referência no dia escolhido, horário/duração/local do próprio grupo; recarrega, edita e recarrega; desativa e confirma registro inativo preservado. Admin repete apenas em fixture autorizada.                                         | PENDENTE |
| Preços                 | Owner cadastra política futura em período livre com valores explícitos, confere após recarregar e edita somente enquanto futura. Verifica histórico iniciado sem editor de conteúdo.                                                                  | PENDENTE |
| Classificação          | Owner/admin classificam integrante sintético ativo em período livre; recarregam e verificam player correto. Convidado deve ser somente avulso.                                                                                                        | PENDENTE |
| Autorização            | Admin consulta preços sem formulário de alteração. Player/guest não acessam administração. Tentativas de submissão indevida devem falhar no servidor/banco, sem dados persistidos; ausência visual isolada não prova autorização.                     | PENDENTE |
| Isolamento             | Conta do segundo grupo tenta abrir a administração do grupo alheio e referenciar somente IDs de fixtures alheias; negar leitura/gravação sem vazamento nem alterações. Não executar sobre IDs de dados reais.                                         | PENDENTE |
| Erros                  | Submeter duração/data inválidas, preço negativo e período sobreposto; apresentar erro sem sucesso. Confirmar após recarregar que versão/fixture anterior não mudou. Em falha de transporte, conferir a lista antes de repetir para evitar duplicação. | PENDENTE |
| Histórico              | Encerrar uma versão sintética em data futura; confirmar que apenas seu fim mudou, sem nova política/classificação criada. Nenhum fluxo deve oferecer substituição automática.                                                                         | PENDENTE |
| Interface e sessão     | Conferir desktop/celular, claro/escuro, teclado e sessão expirada; mensagens legíveis, sem overflow ou acesso após logout.                                                                                                                            | PENDENTE |

Registre SHA local, URL do Codespaces, horário com fuso, cenário, perfil e resultado sanitizado. Não anexe cookies, JWTs, senhas, e-mails ou traces de sessão. Não excluir automaticamente fixtures; preserve manifesto para auditoria. A aprovação destes cenários é independente do relato dos 161 testes de banco. Somente após revisão dos resultados poderá ser solicitada autorização separada para integrar develop/publicar no domínio.

## Reorganização da administração — 13/11/2026

A administração agora abre um painel com cinco cards e destinos próprios, mantendo o controle de acesso por `loadManagedGroup` em cada página:

| Card         | Rota                               | Conteúdo preservado                                                                                                              |
| ------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Dados gerais | `/groups/[slug]/settings/general`  | Nome, descrição e fuso IANA                                                                                                      |
| Integrantes  | `/groups/[slug]/settings/members`  | Participantes ativos, função owner/admin/player/guest e seção separada de classificação mensalista/avulso, vigências e histórico |
| Locais       | `/groups/[slug]/settings/venues`   | Consulta e cadastro dos locais ativos, com o formulário existente                                                                |
| Agenda       | `/groups/[slug]/settings/schedule` | Cadastro/edição/desativação, recorrência, referência, horário, duração e local                                                   |
| Financeiro   | `/groups/[slug]/settings/finance`  | Preços, vencimento, vigência, histórico e encerramento independente                                                              |

Todas as áreas oferecem retorno à administração. Segmentos diferentes dos cinco nomes são rejeitados com notFound; a rota dinâmica não aceita nomes arbitrários de recursos. O painel usa 3 colunas a partir de 1.024px, 2 a partir de 768px e 1 abaixo disso, ícones decorativos, links com foco e tokens oficiais. Indicadores consultam contagens reais, filtradas pelo grupo autorizado: integrantes/locais ativos, agendas ativas e políticas cadastradas. Falhas de indicador aparecem como indisponibilidade, nunca zero fictício, sem divulgar detalhes do banco. O fuso é exibido no card Dados gerais.

A função administrativa define permissões e aparece com nome e código do papel. A classificação financeira tem seção própria em Integrantes, com mensalista/avulso, vigência e histórico; não altera papéis nem concede privilégios. A paginação aponta para a subpágina correspondente e preserva os parâmetros das listas. As consultas operacionais só carregam a seção selecionada. Após sucesso confirmado, as ações revalidam também os cinco destinos concretos do mesmo grupo para atualizar imediatamente formulários/listas e indicadores. Regras e validações de gravação permanecem inalteradas.

Não foram acrescentadas edições/exclusões de locais, papéis ou funcionalidades de participação: esta tarefa reorganiza os recursos já implementados. A antiga seção de participação sem persistência não é exposta como sexto card. O componente desabilitado permanece preservado. Encerramento financeiro continua independente, sem sucessão automática.

### Evidências desta reorganização

- 428 testes em 27 arquivos: PASS, incluindo cinco cards, guardas das subpáginas, seção desconhecida, papéis identificados, erros sanitizados dos indicadores/carregamento, consultas limitadas à seção e paginação com retorno correto.
- Lint, typecheck e build: PASS. Logs locais ignorados `work/stage0042k-reorg-*.log`.
- Layout isolado sintético em Chromium: 6/6 cenários PASS, desktop 1.280px/3 colunas, tablet 820px/2 colunas, celular 390px/1 coluna, cada um claro e escuro. Cinco cards/links/títulos, sem overflow horizontal ou erro de página, primeiro link alcançável por Tab. Capturas desktop escura e celular clara inspecionadas. Relatório local ignorado `work/settings-reorg-visual/report.json`.
- Não se trata de autenticação, navegação ou submissão real. Persistência e autorização autenticadas das telas permanecem pendentes no Codespaces/Preview. Nenhum runner remoto foi repetido, nenhuma fixture criada, nenhuma alteração em banco/RLS/grants/migrations. Regressões SQL não foram repetidas nesta reorganização sem mudança de banco; evidências anteriores permanecem registradas.
- Formatação dos arquivos afetados e `git diff --check`: PASS. A checagem global aponta somente as duas pendências preexistentes em docs/STAGE0032.md e docs/STAGE0032-UI-CHECKLIST.md, mantidas fora do escopo.

Commit e push limitados à `feat/stage0042-operational`, após validação. develop/main e Production preservadas. A URL Preview e o SHA desta reorganização serão informados na resposta de entrega, somente quando localizados na integração Vercel, sem presumir que um Preview anterior contenha o novo código.

Para homologar, use o procedimento de transferência acima, confira o novo SHA e abra a administração de um grupo sintético autorizado. Entre em cada um dos cinco cards e use o retorno. Em Integrantes, confira separadamente função e classificação/validade/histórico; em Financeiro, admin só consulta e owner utiliza os formulários existentes. Reaplique a matriz funcional pendente acima sem alterar grupos reais. Não utilize o domínio Production para conferir a branch de homologação.

## Simplificação de Dados gerais e locais — 13/11/2026

### Entrega parcial segura, sem alteração de banco

O painel passa a quatro cards: Dados gerais, Integrantes, Agenda e Financeiro. Locais deixa de ter card/entrada na navegação principal. O endereço antigo `/settings/venues` redireciona para `/settings/general`; nenhum registro foi excluído. Dados gerais contém:

- **Identificação do grupo:** nome e descrição com persistência existente. A ação atualiza exclusivamente esses dois campos e confirma o retorno da linha antes do sucesso. timezone enviado maliciosamente ou por formulário antigo é ignorado; nenhuma atualização/default de fuso é feita.
- **Local do futebol:** campos de nome, CEP, logradouro, número, complemento, bairro, cidade e estado preparados em fieldset desabilitado, fora do formulário de identificação, sem botão/ação de gravação. O aviso informa explicitamente que ainda não podem ser salvos. Somente complemento é opcional no contrato visual preparado. Validação/persistência efetivas desses campos dependem da modelagem abaixo e **não estão homologadas**.
- **Locais existentes preservados:** listagem somente leitura de nome e endereço livre original, sem converter ou presumir campos, sem escolher um principal e sem apagar registros. Leitura de locais ativos limitada aos primeiros 1.000, com aviso. Locais excluídos logicamente continuam no banco e sob a política existente; a interface não contorna RLS para exibi-los.

### Bloqueio comprovado no esquema versionado

`venues` tem id, group_id, name, address (texto livre até 500 caracteres), timestamps e deleted_at. Não há campo que identifique o principal, nem estrutura de CEP/logradouro/número/complemento/bairro/cidade/UF. O grupo pode ter vários locais e o índice de nome ativo não define principal. Selecionar primeiro/mais antigo/único atualmente existente seria uma inferência, sem vínculo persistente protegido contra concorrência. Não se codificou JSON, marcadores ou endereço concatenado como substituto de modelagem em address.

**Por isso esta entrega não conclui a gravação/edição do local principal nem sua atribuição automática a novas agendas.** A Agenda conserva as operações existentes e a escolha manual de local autorizado do próprio grupo, com aviso de que a seleção automática está em preparação. Agendas já existentes e seus venue_id não foram alterados. Não se removeu proteção de autorização nem se aplicou migration para completar o recurso.

### Alteração mínima proposta — NÃO executada; depende de autorização

1. Adicionar `groups.primary_venue_id uuid NULL`, sem valor padrão ou backfill. FK composta `(id, primary_venue_id)` → `venues(group_id, id)`, aproveitando a unicidade composta existente e com remoção restrita. Isso permite zero principal durante transição e no máximo um por grupo, sem associação entre tenants. Validar também que o local escolhido está ativo, com controle de concorrência na gravação/arquivamento; FK sozinha não verifica deleted_at.
2. Reutilizar `venues.name` e acrescentar sete colunas de endereço: `postal_code`, `street`, `street_number`, `complement`, `neighborhood`, `city`, `state`. Campos inicialmente nullable para manter todos os endereços legados intactos. CEP canônico de oito dígitos, UF brasileira válida e limites de tamanho; número textual para permitir formatos legítimos como s/n. Validação obrigatória de nome/endereço (exceto complemento) quando um local for explicitamente criado/atualizado como principal. Nenhuma tentativa de extrair esses dados de address. Preservar address original e referências existentes.
3. Gravação transacional mínima, preferencialmente RPC SECURITY INVOKER sob as políticas existentes: owner/admin validam vínculo ativo, bloqueiam grupo e local em ordem consistente, gravam endereço e ponteiro do principal juntos. Conceder somente operações/colunas necessárias; não ampliar para player/guest/anon nem usar função privilegiada pública sem necessidade. As policies/grants atuais não autorizam automaticamente as colunas novas: incluir revisão e testes específicos no eventual patch, sem aplicá-los nesta entrega.
4. Na criação de agenda, resolver o principal no servidor a partir do grupo autorizado, desconsiderar venue_id enviado pelo cliente e validar o vínculo composto. Falhar claramente quando não houver principal válido. Não alterar o caminho de atualização de agendas anteriores nem executar UPDATE/backfill de suas referências. Definir/testar serialização com troca do principal para evitar seleção concorrente inconsistente.
5. Regenerar tipos oficialmente após homologação do esquema; testar owner/admin permitidos, player/guest/externo/anon negados, FK entre tenants, principal ausente/inativo, concorrência, rollback integral e preservação dos locais/agendas/fuso. Aplicação remota e quaisquer novos grants/policies/funções exigem autorização própria.

A referência histórica existente é o venue_id: editar o mesmo cadastro pode mudar o nome/endereço exibido ao consultá-lo por uma agenda antiga; o modelo atual não armazena snapshots de endereço. Não se promete histórico imutável desses atributos nem se inventa versionamento nesta entrega. Se também for necessário congelar atributos antigos, revisar essa decisão antes de preparar a migration.

### Validação desta simplificação

- 429 testes automatizados: PASS, incluindo regressões de owner/admin/player/guest e casos de fuso ausente/forjado, quatro cards, redirecionamento legado, campos sem persistência desabilitados e preservação do endereço livre sem parsing.
- Lint, typecheck e build: PASS (revalidação final registrada na entrega). Nenhuma prova JWT remota foi repetida. Não houve alteração de SQL, tipos Database, grants, RLS ou funções do banco; os testes SQL antigos não foram repetidos, e não se aplicou migration sequer como alternativa ao bloqueio de modelagem. As regressões relevantes de ações, formulários, transportes simulados e rotas integram a suíte acima; não equivalem a homologação remota.
- Layout do painel com quatro cards: 6/6 cenários sintéticos locais PASS em desktop/tablet/celular, claro/escuro, com 3/2/1 colunas, sem overflow e com link alcançável por Tab. Relatório ignorado work/settings-primary-visual/report.json. Não representa sessão autenticada real ou gravação de endereço. Formatação dos arquivos afetados e git diff --check: PASS.
- Alterações somente na `feat/stage0042-operational`. A publicação da branch de homologação não libera principal/endereço detalhado nem configura novas agendas automaticamente. develop/main/Production e Supabase remoto preservados. Nenhuma migration foi criada ou executada.

Próximo ponto de decisão: autorizar a preparação do patch de modelagem acima para revisão e homologação separada, antes de qualquer execução. A identificação e o painel com quatro cards podem ser conferidos no Preview; os requisitos dependentes do principal permanecem explicitamente **PENDENTES**.
