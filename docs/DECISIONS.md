# Registro de decisões

Status: **adotada** significa decisão da fundação; **proposta** requer revisão antes do banco. Data desta execução: 19/10/2026.

| ID      | Status                     | Decisão e consequência                                                                                                                                                                       |
| ------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 | Adotada                    | Preservar Next.js App Router, React e clientes Supabase anteriores; reorganizar em src. Sem recomeçar a aplicação em outro framework.                                                        |
| ADR-002 | Adotada                    | Node 24/npm 11. Dependências exatas e lockfile. A versão de TypeScript é ajustada à faixa aceita pelo parser ESLint; não adotar a versão mais recente incompatível.                          |
| ADR-003 | Adotada                    | Tailwind 4/PostCSS e componentes shadcn/ui locais, com tokens sem marca de tenant. Sem biblioteca de layout adicional.                                                                       |
| ADR-004 | Adotada                    | Sem configuração real nesta etapa. O `.env.local` preexistente foi guardado em `work/previous.env.local`, ignorado, e não é carregado. Não precisa restaurá-lo para desenvolver a interface. |
| ADR-005 | Adotada                    | Auth opcional para iniciar; ausência de configuração desabilita os fluxos, retorna 503 na API e mostra preparação na área reservada. Nenhum bypass de sessão ou mock de dados no produto.    |
| ADR-006 | Adotada                    | Revalidar com getUser no servidor. Guards nas páginas/APIs além do proxy; clientes por requisição e respostas privadas sem cache.                                                            |
| ADR-007 | Substituída pela Etapa 002 | Tenant é um grupo. Papéis owner/admin/member vêm de group_members ativos e não de JWT user_metadata.                                                                                         |
| ADR-008 | Substituída pela Etapa 002 | Perfil global privado separado de jogador esportivo por grupo. Convidado pode existir sem conta e sem vínculo de acesso.                                                                     |
| ADR-009 | Substituída pela Etapa 002 | Perfil tem UUID próprio e auth_user_id único anulável: conta removida desvincula acesso e permite anonimizar histórico sem cascata destrutiva.                                               |
| ADR-010 | Implementada na Etapa 002  | UUIDs, timestamptz, FKs compostas para integridade entre tenants, constraints e exclusão lógica seletiva. Modelo ainda sem migration.                                                        |
| ADR-011 | Implementada na Etapa 002  | RLS deny-by-default; políticas por operação e vínculo; operações sensíveis transacionais. Helpers privados estreitos somente quando necessários para evitar recursão.                        |
| ADR-012 | Adotada                    | Manifesto e ícones PWA sem service worker: não existe cache offline privado.                                                                                                                 |
| ADR-013 | Adotada                    | Sem ORM, repository genérico, SDK administrativo, endpoints CRUD ou funcionalidades esportivas nesta etapa.                                                                                  |
| ADR-014 | Adotada                    | UI provisória Em Campo; 4ª Força será apenas o primeiro tenant.                                                                                                                              |

## Pendências para a próxima etapa

1. Aprovar modelo e matriz de permissões, especialmente visibilidade de elenco e convites.
2. Definir se haverá exatamente um owner ou múltiplos. Proposta atual: um owner ativo, com transferência atômica.
3. Definir retenção, anonimização, exclusão de contas e obrigações de privacidade. Exclusão lógica não substitui eliminação de PII.
4. Definir convite por e-mail, verificação e expiração, aceitação transacional e reivindicação de convidados (sem vínculo automático por nome/e-mail informado).
5. Selecionar ambiente Supabase de desenvolvimento; configurar Auth, SMTP, URLs permitidas e testar fluxos reais. Não usar produção para experimentação.
6. Revisar helpers de RLS e privilégios efetivos; criar migrations locais, testes de isolamento e tipos Database gerados somente após o schema existir.
7. Definir limites/MIME de Storage, políticas, URL assinada e limpeza de objetos.
8. Aprovar nome, marca, tema por grupo, termos de uso e política de privacidade.
9. Definir regras de presença, fuso inicial por grupo, cancelamento e eventual auditoria por eventos.
10. Definir projeto Vercel, domínios, observabilidade sem PII, CI e política de Preview. Nenhum provisionamento foi realizado.
11. Atualizar ESLint e plugins do Next.js em conjunto para uma linha suportada sem conflitos de peer dependencies.
12. Avaliar PWA instalável e cache somente de assets públicos, com revisão explícita de dados privados.

## Compatibilidade com o trabalho anterior

Arquivos anteriores estavam sem commit, além do README e .gitignore originais. Foram inspecionados e preservados quando úteis. Cópia local dos fontes anteriores em `work/previous-foundation/` (ignorada). Paths mudaram de app/lib na raiz para src/app e src/lib. Formulário e ações passaram a features/auth. O produto deixou de depender do arquivo real de ambiente da etapa anterior. A antiga documentação de verificação não é reutilizada como evidência para esta nova versão; novas verificações serão executadas.

## Decisões da Etapa 002 (Prompt 002)

Estas decisões implementam a nova especificação; substituem somente propostas da Etapa 001 que conflitavam com os campos agora exigidos. Decisões já adotadas de framework, segurança de sessão, neutralidade de marca e ausência de deploy foram preservadas.

| ID      | Status                              | Decisão                                                                                                                                                                                                                                                                                      |
| ------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-015 | Implementada para revisão           | profiles.id referencia auth.users; players.user_id opcional e único identifica uma conta esportiva global. Convidados usam origin_group_id e não podem ser reclamados unilateralmente. Substitui ADR-008/009 propostas.                                                                      |
| ADR-016 | Implementada para revisão           | group_members liga player a grupo, com owner/admin/player/guest e active/invited/suspended/left. UNIQUE permanente reutiliza o vínculo no reingresso; auditoria privada preserva mudanças. Substitui os papéis propostos em ADR-007.                                                         |
| ADR-017 | Implementada para revisão           | Exatamente um owner ativo elegível, com índice parcial, constraint triggers diferidas e transferência atômica sob lock de grupo. Admin não altera owner, a si ou outros admins.                                                                                                              |
| ADR-018 | Implementada para revisão           | Helpers/implementações privilegiadas ficam em private, com search_path vazio. app_executor é NOLOGIN/NOBYPASSRLS e dono apenas dos objetos de aplicação; postgres recebe membership para manutenção de migrations. Nenhum cliente recebe esse papel. Wrappers públicos são SECURITY INVOKER. |
| ADR-019 | Implementada para revisão           | Convite reutilizável por hash SHA-256, max_uses/uses_count e revogação. Sem SELECT de hashes nem aceite público. RPC de listagem só retorna metadados.                                                                                                                                       |
| ADR-020 | Implementada para revisão           | Presença tem group_id adicional para FKs compostas com partida e vínculo. Lock de partida/grupo impede excesso de capacity. Promoção/FIFO e idempotência ficam para a próxima etapa.                                                                                                         |
| ADR-021 | Pendente de política de privacidade | FKs históricas RESTRICT impedem remoção cega de contas. Arquivamento/anonimização e retenção de auditoria precisam de processo explícito antes de produção.                                                                                                                                  |
| ADR-022 | Adotada                             | CLI Supabase 2.81.3 fixado para migrations/new e geração local. O instalador não respeitou o proxy desta sessão; binário oficial foi obtido via proxy e checksum verificado, apenas em node_modules/work ignorados. Nenhum login ou vínculo remoto foi configurado.                          |
| ADR-023 | Adotada                             | Testes reproduzíveis em PostgreSQL 17.6 fixado por digest, sem rede/portas, com contrato Auth mínimo. A pilha Supabase completa e os tipos Database ainda exigem validação/geração local oficial. Não fabricar interfaces Database.                                                          |

### Pontos que ainda exigem decisão/aprovação antes da implantação

1. Confirmar identidade esportiva global compartilhada entre grupos versus apelido/posição locais por vínculo. Não permitir admin alterar a identidade global de outra conta.
2. Confirmar exatamente um owner e a regra de que admin não promove nem gerencia pares. Não há superadministrador de tenant no frontend.
3. Definir reivindicação/mesclagem de convidados com prova de consentimento e resolução de player já vinculado; nenhuma API de claim existe por enquanto.
4. Definir anonimização, exclusão de contas e prazo de retenção de auditoria/convites. As FKs RESTRICT são seguras contra perda de histórico, mas ainda não constituem um fluxo de eliminação de PII.
5. Implementar aceite de convites com limite de usos, expiração e verificação transacional. Gerar tokens criptográficos fora do banco e persistir somente hash.
6. Aprovar simultaneidade de partidas e unicidade inicial de nomes de locais; não foi imposta unicidade de horário.
7. Definir lista de espera FIFO, chave de ordenação, promoção e cancelamento idempotentes em operação única. Não confiar em contagem feita no navegador.
8. Validar no Supabase local completo (extensões, roles/default privileges, PostgREST/JWT), rodar lint/advisors e gerar tipos. Testes do container não comprovam esses serviços.
9. Inspecionar compatibilidade e histórico do projeto remoto somente quando autorizado, antes de considerar staging. Nenhum schema remoto foi pressuposto ou alterado.

As cinco migrations desta etapa são novas e ainda não fazem parte de um histórico Supabase aplicado; nenhuma migration anterior existente foi editada. Ensaios SQL descartáveis foram usados durante a elaboração, sem histórico remoto.

## Etapa 002.2 — desenvolvimento remoto

- ADR-024 (adotada): projeto de desenvolvimento autorizado plataforma-futebol / hpbvtqvbtyioqjyelrpb. Cinco migrations aplicadas por MCP oficial com mapeamento de versões e hashes em supabase/development-migrations.json. Não reaplicar pelo CLI sem reconciliação explícita do histórico.
- ADR-025 (adotada): tipos gerados oficialmente do remoto e integrados aos três clientes; configuração publicável somente em arquivo local ignorado. Não configurar credencial administrativa no frontend.
- ADR-026 (proposta, aguarda autorização adicional): bridge privada mínima para auth.uid(), pois postgres gerenciado não consegue delegar USAGE do schema auth para app_executor. Arquivo revisável em docs/proposals/auth-schema-bridge.sql, sem aplicação; teste local passou, teste remoto atual falhou antes dessa correção.
- ADR-027 (pendente): revisar ACLs da função de event trigger preexistente public.rls_auto_enable, apontada pelos advisors; não alterar infraestrutura além das cinco migrations autorizadas nesta execução.
- ADR-028 (adotada): develop preserva todas as fontes das duas etapas; PR rascunho para main enquanto houver bloqueio de integração. Sem merge automático e sem deploy Vercel.

As afirmações anteriores de banco remoto intocado e tipos ainda pendentes descrevem o estado das Etapas 001/002. O estado atual está em DEPLOYMENT.md e no início de VERIFICATION.md. Etapa 003 pode ser preparada, mas autenticação/CRUD de grupos ainda dependem da correção e de testes Auth/API reais.

## Etapa 002.3 — ponte privada de identidade

ADR-026 aprovada e implementada em 20/10/2026 pela migration 20261020160133_auth_schema_bridge.sql; versão MCP 20261020160511. A ponte private.auth_user_id() usa exclusivamente auth.uid(), sem argumentos/consultas de tabelas, com owner postgres, SECURITY DEFINER STABLE e search_path vazio. EXECUTE somente do proprietário e app_executor. O executor não recebe USAGE em auth ou SELECT em auth.users. Acesso indireto ocorre somente pelo contexto das sete implementações privadas existentes, cujas regras/ACLs/proprietários foram preservados; retorna a identidade do request, não identidade do proprietário da função.

Definições explícitas CREATE OR REPLACE substituem a proposta de edição dinâmica. Um único DO com DDL estático torna criação, alterações e pré/pós-condições atômicas. Guardas conferem assinatura, proprietário, fonte esperada, ACLs, volatilidade e search_path das sete funções; falham diante de divergências ou ponte preexistente. Hashes MD5 de fonte detectam divergência de estado, não são mecanismo criptográfico de autorização. Pós-condições verificam ausência de novos grants no Auth e allowlist de EXECUTE da ponte. Os cinco arquivos anteriores permanecem inalterados.

A correção libera o desenvolvimento da Etapa 003 no nível SQL. Homologação de autenticação depende de testes Auth/API HTTP com JWTs reais; o proxy do executor Codex continua uma limitação distinta do Codespaces. Avisos preexistentes de rls_auto_enable permanecem fora desta autorização.

## Etapa 003

- ADR-029 (adotada): ensure_my_identity prepara profile/player próprios atomicamente, com constraints de unicidade e ON CONFLICT DO NOTHING. Nome de metadata é apenas apresentação. save_my_identity atualiza somente atributos próprios em uma transação; falha não deixa perfil parcialmente editado.
- ADR-030 (adotada): recibos privados de mutação por ator/request_id e SHA-256 do payload tornam grupo/convidado repetíveis sem duplicação após resposta perdida. Não deduplicar por nome. Nova intenção usa nova chave; retries mantêm chave/campos. Retenção dos recibos permanece pendente antes de produção.
- ADR-031 (adotada, exceção restrita): quatro APIs públicas novas são SECURITY DEFINER de owner app_executor, não postgres/service role, validam auth_user_id() e delegam a implementações fixas. Novos auxiliares privados não têm grants de cliente. Os wrappers anteriores continuam invoker. Revisão automática rejeitou a proposta inicial com grants privados; alternativa elimina esses grants e passou testes de autorização. Advisors sinalizam quatro novos WARN autenticados intencionais, documentados e revisados, sem conceder EXECUTE a anon.
- ADR-032 (adotada): callback usa somente a origem configurada e destinos fixos; recuperação/reenvio usam PKCE real e respostas genéricas. A configuração de confirmação/SMTP do provedor é respeitada, não alterada ou simulada.
- ADR-033 (adotada): listas autenticadas server-side, elenco paginado em 20 vínculos ativos e dashboard limitado a 100 vínculos recentes com aviso. Nenhuma tela de alteração de papel/convite público/exclusão foi adicionada.
- ADR-034 (pendente de homologação): script real no Codespaces usa dois usuários fictícios confirmados, publishable/JWTs nas provas e conexão privilegiada somente para preflight/limpeza estritamente delimitada. Cadastro/SMTP/cookies SSR e recuperação exigem checklist real. Etapa 003 não é homologada pelo sucesso de mocks ou SQL com claims.

## Etapa 004.2 — configuração de grupos

- ADR-035 (implementada localmente): exatamente owner/admin/player/guest. Agendas e classificação financeira são operadas por owner/admin; preço/vencimento/vigência somente owner. Leitura de agendas/preços por vínculos ativos; classificação individual só do próprio jogador ou gestores do grupo. Guest sem conta não tem sessão; guest autenticado tem somente leitura autorizada, classificação casual e nenhum privilégio de escrita.
- ADR-036 (implementada localmente): recorrência local semanal/quinzenal com starts_on como primeira ocorrência/âncora alinhada ao DOW 0–6. Fuso vem de groups.timezone; ends_on inclusiva. Nenhuma geração automática e nenhuma decisão implícita sobre DST.
- ADR-037 (implementada localmente): preços/classificações em intervalos `[from,until)`, datas finitas e exclusões GiST por grupo/vínculo, com btree_gist em extensions. Sem backdate, sem DELETE, dados iniciados imutáveis salvo encerramento futuro; troca exige transação que fecha versão anterior e insere próxima. Nenhum valor financeiro default ou preço especial de guest. Clamp de vencimento 29–31 pertence ao futuro módulo de cobrança.
- ADR-038 (implementada localmente): RLS mais grants de coluna e triggers privados de owner técnico, sem nova RPC pública. Lock de grupo e revalidação de papel seguem o padrão existente. Novo guard de papel em group_members impede contornar guest=casual; não muda permissões existentes. Tipos das novas tabelas exigem geração oficial posterior, nunca preenchimento manual. Nenhuma autorização para migration remota ou produção.
