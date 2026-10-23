# Testes SQL de segurança

`npm run db:test` exige Docker Linux e usa daemon local via unix:///var/run/docker.sock, ignorando seletores de daemon remoto. Cria um container PostgreSQL sem rede/portas, aplica migrations em ordem e o remove em finally. Nunca aponta para o Supabase remoto ou para um banco local do usuário.

- bootstrap.sql: contrato mínimo de Auth/papéis; não é migration nem simulação de RLS.
- fixtures.sql: dados sintéticos, inicialmente preparados com privilégios explícitos; não representam dados do produto.
- security.sql: SET SESSION AUTHORIZATION authenticated/anon para que tanto current_user quanto session_user sejam não privilegiados. Fixtures não são usadas para alegar autorização de cliente. Asserções checam SQLSTATE e linhas realmente visíveis.
- Duas checagens finais de defesa de invariantes e inspeção de auditoria usam postgres, separadas das provas de RLS. Um trigger temporário força falha na última escrita de uma transferência e demonstra rollback do primeiro UPDATE.
- O runner também abre duas conexões em cada corrida: última vaga e transferências concorrentes. Exatamente uma transação deve vencer.

O ensaio não inicia GoTrue/Auth, PostgREST, Storage nem extensões Supabase. Testes HTTP com JWTs reais de desenvolvimento, db lint/advisors e geração de tipos na pilha completa permanecem necessários. Não usar service_role para validar isolamento.

Etapa 002.3: o runner aplica seis migrations. Antes da bridge, revoga USAGE de auth ao executor para reproduzir a restrição hospedada; injeta uma falha de pós-condição para provar rollback de DDL e então aplica a migration real, cujas pré-condições revalidam as sete funções originais. auth-bridge.sql cobre identidade/null e ACLs; development-smoke.sql cria fixtures aleatórias, exercita grupos/convidados/convites e reverte tudo. Esses dois testes também podem ser executados pelo MCP no desenvolvimento expressamente autorizado. Usam SET LOCAL ROLE por compatibilidade com postgres não superuser; security.sql mantém SET SESSION AUTHORIZATION não privilegiado no ensaio local. Nenhum desses scripts é teste de JWT/HTTP real.

Etapa 003: stage003.sql exercita identidade, grupo/owner, convidado/posição, retries, slug duplicado, isolamento e rollback do perfil/recibos. O runner aplica sete migrations e inclui três corridas: vaga, repetição concorrente do mesmo convidado e transferência. As 70 asserções originais permanecem, com a checagem de funções públicas ajustada apenas para a allowlist explícita de APIs autenticadas SECURITY DEFINER com owner técnico e search_path vazio. Novas implementações privadas continuam inacessíveis a authenticated/anon. Os ensaios SQL não são testes HTTP ou JWT real.
