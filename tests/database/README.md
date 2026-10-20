# Testes SQL de segurança

`npm run db:test` exige Docker Linux e usa daemon local via unix:///var/run/docker.sock, ignorando seletores de daemon remoto. Cria um container PostgreSQL sem rede/portas, aplica migrations em ordem e o remove em finally. Nunca aponta para o Supabase remoto ou para um banco local do usuário.

- bootstrap.sql: contrato mínimo de Auth/papéis; não é migration nem simulação de RLS.
- fixtures.sql: dados sintéticos, inicialmente preparados com privilégios explícitos; não representam dados do produto.
- security.sql: SET SESSION AUTHORIZATION authenticated/anon para que tanto current_user quanto session_user sejam não privilegiados. Fixtures não são usadas para alegar autorização de cliente. Asserções checam SQLSTATE e linhas realmente visíveis.
- Duas checagens finais de defesa de invariantes e inspeção de auditoria usam postgres, separadas das provas de RLS. Um trigger temporário força falha na última escrita de uma transferência e demonstra rollback do primeiro UPDATE.
- O runner também abre duas conexões em cada corrida: última vaga e transferências concorrentes. Exatamente uma transação deve vencer.

O ensaio não inicia GoTrue/Auth, PostgREST, Storage nem extensões Supabase. Testes HTTP com JWTs reais de desenvolvimento, db lint/advisors e geração de tipos na pilha completa permanecem necessários. Não usar service_role para validar isolamento.
