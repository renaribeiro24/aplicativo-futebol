# Etapa 003.2 — checklist de interfaces privadas

Estado em 26/10/2026: **automação privada PASS nas quatro combinações; homologação manual complementar PARCIAL (7 PASS relatados, incluindo Android físico; 1 critério agregado PENDENTE: loading/vazio)**. Não interpretar testes locais de preparação como uma sessão autenticada. Status permitidos: PASS, FAIL, PENDENTE, NÃO APLICÁVEL. Só registrar PASS após executar; justificar NÃO APLICÁVEL e registrar evidência/observação. FAIL não significa automaticamente falha de segurança: distinguir produto, executor e ambiente.

## Resultado automatizado privado recebido em 26/10/2026

**PASS: 46 aprovados, zero reprovados**, modo authenticated_owner_readonly e diagnosticOnly=false, conforme captura do proprietário. Relatório no Codespaces: work/stage0032-ui-0b8dce63-aa96-4a99-bacf-d8f40d525405/report.json. O arquivo privado não foi lido nesta sessão; fonte é a saída sanitizada. Desktop claro/escuro e celular claro/escuro passaram. Não repetir essa matriz ou login apenas para preencher os itens manuais abaixo.

Os status PENDENTE da tabela manual representam os critérios completos ainda não atestados, incluindo submissões, interpretação visual/contraste e estados especiais. Não anulam os PASS automatizados. Usar a evidência existente para os subcritérios já cobertos e executar apenas o complemento: salvar convidado/perfil em dados fictícios, mensagens/validações, foco/contraste/zoom, loading/vazio elegível, UI da conta C e direção B→A. Não inferir legibilidade, acessibilidade completa ou sucesso de gravação só por heading/status HTTP.

## Homologação manual complementar — relato do proprietário em 26/10/2026

Fonte: resultados comunicados pelo proprietário nesta conversa. Os resultados abaixo não representam execução independente pelo agente, nem substituem a evidência automatizada de 46 PASS. Dispositivo, navegador, hora exata e identificadores das fixtures não foram informados; não atribuir aprovação individual a todas as quatro combinações sem evidência específica.

| Critério comunicado | Resultado | Correspondência no checklist | Observação |
| --- | --- | --- | --- |
| Cadastro de convidado fictício | PASS (relatado) | UI08 | Confirmar ID da fixture UI e persistência em manifesto privado, sem dados pessoais |
| Salvamento de perfil técnico | PASS (relatado) | UI11 | Preservar evidência sanitizada de persistência |
| Mensagens e validações | PASS (relatado) | UI09, parte de UI19 | Não implica contraste quantitativo certificado |
| Acessibilidade e navegação | PASS (relatado) | UI02, UI18–UI20 | Escopo/dispositivos não especificados; não declarar conformidade WCAG |
| Controles visuais de C | PASS (relatado) | UI17 | Não substitui os 20 checkpoints JWT aprovados |
| Isolamento B → A | PASS (relatado) | UI14 (direção B → A) | Não inferir repetição A → B manual; testes automatizados preservados |
| Loading e estado vazio | PENDENTE | UI21, UI22 | Testar navegação GET com rede lenta; vazio apenas se conta técnica elegível existir |
| Celular físico | PENDENTE | UI24 | Testar teclado virtual, toque, zoom e botões em aparelho real |

**Critérios de encerramento:** manter UI21, UI22 e UI24 pendentes até execução ou decisão justificada de não aplicabilidade, quando cabível. O resultado manual genérico não autoriza converter automaticamente todas as células D/C, D/E, M/C, M/E para PASS. Manter os resultados de automação registrados, PR #1 Draft e etapa 003.2 ABERTA. Não executar novas mutações, limpar fixtures, promover main ou publicar em produção por causa desta atualização documental.

### Complemento — celular físico Android (26/10/2026)

O proprietário relatou **PASS sem problemas** na homologação manual em aparelho Android, após roteiro de menus, textos, botões, teclado virtual, toque, formulários, rolagem horizontal e legibilidade. Marca-se **UI24 / Android: PASS (relatado)**. Modelo, navegador/versão, evidência por tema e teste em iOS não foram informados; não atribuir aprovação específica a iOS ou a combinações não documentadas. UI21 (loading) e UI22 (dashboard vazio elegível) continuam PENDENTES. Etapa 003.2 ABERTA, PR #1 Draft.

## Preparação e segurança

- Responsável técnico: ______; data/hora (America/Sao_Paulo): ______; navegador/versão: ______.
- Domínio: https://www.borafute.com.br. Antes de iniciar, conferir implantação realmente associada ao alias, commit, branch e target=Preview. Registrar deployment: ______; commit servido: ______; HEAD develop: ______. Não editar DNS/domínios/alias nem promover produção.
- Inspeção de 26/10: alias fixo aponta a dpl_Gf8Px4vi8NhfP8viPajE5TXBzHA2, READY, develop@2c0447d, não ao HEAD 18f53ef daquela inspeção. Comparação não encontrou alterações em src/ nesse intervalo; ferramentas/lockfile/documentação mudaram. Isso não certifica equivalência de todo o ambiente nem implantação dos commits posteriores. Não extrapolar o resultado para outro deployment.
- Usar exclusivamente contas técnicas já existentes e confirmadas. Não criar/excluir usuários. Secrets somente no executor/arquivo ignorado; não salvar HAR, traces, storageState, cookies, senhas ou JWTs em artefatos.
- 4ª Força, Grupo Teste 2 e suas relações são intocáveis. Evitar capturar seus nomes/conteúdos mesmo se a conta os listar. Capturas privadas devem ser recortadas/mascaradas e conter apenas dados fictícios; não publicar e-mails ou dados de sessão.
- Para submissões de cadastro de grupo/convidado, usar um grupo sintético **separado para UI**, por exemplo audit-ui-20261026-SUFIXO (minúsculo), e nomes fictícios. Registrar IDs em manifesto privado. Não acrescentar membros aos grupos sintéticos A/B da suíte C, cuja fixture exige três integrantes em A. Preservar novas fixtures; nenhuma limpeza automática.
- Operações persistentes podem ser comprovadas uma única vez em fixture UI separada; nos quatro temas/tamanhos, rever layout e o resultado persistido, sem criar quatro cópias desnecessárias.
- Ambiente sem conta apropriada, estado vazio elegível ou conectividade: PENDENTE, com motivo. Não fabricar estado removendo vínculos, relaxando RLS ou criando usuários.

## Matriz privada obrigatória

D/C = desktop claro (1440 × 900); D/E = desktop escuro; M/C = celular claro (390 × 844); M/E = celular escuro. Viewport Chromium não substitui dispositivo físico/touch/Safari; registrar dispositivo real quando disponível. Tema via preferência do sistema/DevTools; não exigir um seletor de tema que a aplicação não possui.

| ID   | Teste objetivo                                                          | Resultado esperado                                                                           | D/C           | D/E           | M/C           | M/E           | Observações/evidência                                                        |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------- | ------------- | ------------- | ------------- | ---------------------------------------------------------------------------- |
| UI01 | Abrir /login e entrar com conta técnica A                               | Formulário legível; sessão leva ao dashboard; /api/me 200; não há proteção Vercel inesperada | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI02 | Entrar com teclado: Tab/Shift+Tab/Enter                                 | Ordem coerente, foco visível, labels e botão acionáveis, sem armadilha                       | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI03 | Abrir dashboard autenticado                                             | Saudação e grupos autorizados; conteúdo privado não é aviso de preparação                    | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI04 | Selecionar grupo sintético listado no dashboard                         | Navegação abre exatamente o grupo selecionado                                                | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI05 | Abrir detalhes do grupo sintético                                       | Nome, papéis e dados esperados; nenhum dado de outro grupo                                   | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI06 | Conferir elenco e convidado existentes                                  | Identificação/papel corretos; textos e lista legíveis, sem cortes ou overflow                | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI07 | Como owner, visitar formulário de convidado                             | Campos/seletores/botão visíveis; labels, foco e dimensões utilizáveis                        | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI08 | Cadastrar um convidado fictício no grupo UI separado                    | Uma inclusão, sucesso compreensível e persistência após recarregar; registrar fixture        | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Uma submissão; rever resultado nas quatro combinações                        |
| UI09 | Enviar campos obrigatórios vazios/posição inválida, sem criar registros | Validação compreensível junto ao formulário; sem perda de navegação ou alteração persistente | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Preferir validação HTML; não disparar logins inválidos repetidos             |
| UI10 | Abrir Meu perfil                                                        | Somente perfil da conta técnica; valores, labels e seletores legíveis                        | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Não registrar valores pessoais                                               |
| UI11 | Salvar alteração fictícia no perfil técnico                             | Sucesso e persistência; nenhuma alteração no perfil de outro usuário                         | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Não mudar e-mail/senha; registrar antes/depois só em privado                 |
| UI12 | Navegar Visão geral/Meu perfil/Criar grupo/Voltar ao início             | Links funcionam e mantêm sessão; layout adapta navegação sem sobreposição indevida           | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI13 | Abrir /groups/new e validar campos                                      | Formulário acessível; regras de identificador e mensagens claras                             | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Criação opcional do grupo UI, nunca usuário novo                             |
| UI14 | Acessar URL sintética do grupo B usando A, e vice-versa                 | Tela not-found, sem IDs/nomes/detalhes privados; 200 em streaming não basta para reprovar    | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Complementa SSR/Data API; não os substitui                                   |
| UI15 | Abrir /ui-audit-not-found                                               | Tela de página inexistente legível e link de retorno funcional                               | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI16 | Sair da conta e tentar dashboard/grupo/perfil novamente                 | Login solicitado; /api/me 401; sem conteúdo privado reaparecendo após navegação/refresh      | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Logout efetivo uma vez; guardar sessão só em memória                         |
| UI17 | Como C, abrir grupo A e conferir controles                              | Leitura autorizada; controles administrativos não aparecem/funcionam                         | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Usar vínculo C existente; não alterá-lo                                      |
| UI18 | Inspecionar larguras, zoom e textos longos fictícios                    | Sem rolagem horizontal inesperada, truncamento de conteúdo essencial ou campos inacessíveis  | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Testar zoom 200% no desktop                                                  |
| UI19 | Conferir contraste e estados de foco/erro/sucesso                       | Texto normal ≥4,5:1; grande ≥3:1 quando aplicável; informação não depende só de cor          | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Medir com ferramenta existente; não é certificação WCAG completa             |
| UI20 | Tab por navegação, lista e formulários; usar skip link                  | Foco visível e ordem coerente; conteúdo principal alcançável                                 | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | —                                                                            |
| UI21 | Usar rede lenta em uma navegação GET e restaurar                        | Loading compreensível, sem vazamento de outro grupo e sem travamento após conclusão          | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Não repetir POST para observar loading                                       |
| UI22 | Dashboard vazio com conta técnica existente elegível, se disponível     | Estado vazio claro e ação apropriada                                                         | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Sem conta elegível: manter pendente/justificar decisão; não excluir vínculos |
| UI23 | Observar console e requisições durante jornada                          | Sem erro JS não tratado ou erro de recurso inesperado; guardar apenas categorias sanitizadas | PENDENTE      | PENDENTE      | PENDENTE      | PENDENTE      | Prefetch cancelado esperado não é falha do produto                           |
| UI24 | Complementar: em celular físico, abrir teclado e acionar campos/botões  | Controles alcançáveis, sem teclado encobrir ação e sem dependência de hover                  | NÃO APLICÁVEL | NÃO APLICÁVEL | PENDENTE      | PENDENTE      | Registrar navegador/dispositivo real                                         |
| UI25 | Procurar rota /groups de listagem independente                          | Não há página existente /groups; a listagem é no dashboard                                   | NÃO APLICÁVEL | NÃO APLICÁVEL | NÃO APLICÁVEL | NÃO APLICÁVEL | Não inventar rota/funcionalidade                                             |
| UI26 | Menu hambúrguer e aceite de convite público                             | Não existem nessa entrega; navegação é flex/sidebar, e aceite público não foi implementado   | NÃO APLICÁVEL | NÃO APLICÁVEL | NÃO APLICÁVEL | NÃO APLICÁVEL | Não implementar funcionalidades nesta etapa                                  |

## Automação disponível, sem novas dependências

scripts/test-stage0032-ui.mjs reutiliza Playwright/Chromium já instalados. Não executa npm install, não instala browsers, não persiste storageState/HAR/traces e não tira capturas de páginas privadas. Nenhuma dependência foi adicionada. Se o Codespaces não tiver essas ferramentas, registrar bloqueio e executar a matriz manualmente; eventual instalação exige justificativa e revisão separada.

```sh
node --env-file=work/stage0032.test.env scripts/test-stage0032-ui.mjs --check
node --env-file=work/stage0032.test.env scripts/test-stage0032-ui.mjs --authenticated
```

Modo autenticado exige TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD e TEST_ACCOUNTS_ARE_SYNTHETIC=1. Usar somente owner técnico A do grupo sintético conhecido. O executor faz um login para toda a matriz, sem cadastrar usuários/grupos/convidados, sem submeter perfil ou formulário de criação; confere páginas, conteúdo próprio/not-found alheio, navegação, labels, foco básico, overflow, erros e logout. Não substitui UI08/UI11, contraste completo, estados vazio/loading, C visual ou dispositivo físico. Antes de preencher senha, verifica origem do login e heading da aplicação; redirect externo/proteção bloqueia o fluxo. Nunca desabilitar Deployment Protection para passar.

Artefatos em work/stage0032-ui-RUN/report.json (0600), com flags/contagens sem texto privado. Em falha, parar na primeira fronteira e revisar checkpoint; não repetir submissões cegamente. DOM checks usam um Tab e associação básica de labels, não auditoria de acessibilidade completa. Erros de rede continuam visíveis; somente ERR_ABORTED com next-router-prefetch=1 é categorizado como cancelamento especulativo esperado.

Para repetir apenas QA público local, em build sem Supabase configurado, iniciar npm start na porta 3300 e usar --local-public. Resultado desse modo deve ser rotulado público/preparação, nunca privado. Relatório de 26/10: 45 verificações passaram em 40 visitas, quatro combinações; imagens somente da home pública. Todos os itens privados acima continuam pendentes.

## Diagnóstico dirigido de rede

Se a matriz reprovar apenas em network no dashboard, usar uma vez --authenticated --dashboard-only após atualizar o executor. Esse modo testa somente o dashboard privado em desktop claro, com um login e as verificações públicas iniciais; não aprova as outras combinações. A saída inclui failedChecks com networkFailures sanitizados (código/tipo/método/categoria/lifecycle), sem URL ou dados de sessão. A falha desconhecida permanece bloqueante até identificação; não ignorar aborts não classificados ou repetir toda a matriz às cegas. Procedimento em STAGE0032.md.

## Revisão do relatório C sem repetir autenticação

O arquivo informado pelo proprietário fica no Codespaces, não no executor atual. Para produzir resumo seguro somente leitura:

```sh
node --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
try {
const r = JSON.parse(readFileSync('work/stage0032-member-c-02b9bebb-47e0-400a-b03d-5c4035b10f2f.json', 'utf8'));
const checks = Array.isArray(r.checks) ? r.checks : [];
console.log(JSON.stringify({
  result: ['PASS','FAIL'].includes(r.result) ? r.result : 'UNKNOWN',
  checkpoints: checks.length,
  passed: checks.filter(c => c.passed === true).length,
  failed: checks.filter(c => c.passed === false).length,
  integrityChecked: r.integrity?.checked === true,
  unchanged: r.integrity?.unchanged === true,
  originalOwnerUnique: r.integrity?.originalOwnerUnique === true,
  cPlayerActive: r.integrity?.cPlayerActive === true
}));
} catch { console.error('Relatório indisponível ou inválido; conteúdo suprimido'); process.exitCode = 1; }
JS
```

Esperado conforme relato: PASS, 20 checkpoints, 20 aprovados, zero reprovados e flags de integridade true. Não compartilhar o arquivo bruto, conteúdo de sessão ou dados pessoais. Não executar novamente a suíte C só para ler esse relatório.

## Registro de defeitos e encerramento

Registrar cada problema com ID, gravidade (crítica/alta/média/baixa), combinação, passos, esperado/observado e evidência sanitizada. Separar defeito do produto de bloqueio do ambiente/executor. Aprovação final exige itens obrigatórios PASS ou NÃO APLICÁVEL justificado, nenhum FAIL bloqueante e evidências revisadas. PENDENTE não equivale a aprovação. A matriz privada permanece requisito independente dos testes JWT/SSR.
