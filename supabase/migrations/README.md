> **Etapa 003:** sete migrations aplicadas. A nova 20261020161609_stage003_identity_workflows.sql é a versão MCP 20261020162554. Não reaplicar as anteriores nem usar db push sem reconciliar o mapeamento em ../development-migrations.json. Ver ../../docs/STAGE003.md.

> **Atualização Etapa 002.3:** seis migrations aplicadas ao desenvolvimento. A sexta é 20261020160133_auth_schema_bridge.sql (MCP 20261020160511), sem alterações nos cinco arquivos originais. O histórico abaixo registra as etapas anteriores. Conferir ../development-migrations.json e ../../docs/DEPLOYMENT.md antes de qualquer operação; não reaplicar.

> **Estado em 20/10/2026:** as cinco migrations abaixo foram aplicadas ao desenvolvimento hpbvtqvbtyioqjyelrpb por MCP. As versões geradas pelo MCP estão em ../development-migrations.json. Não executar db push contra esse projeto com os nomes locais sem reconciliar o histórico: veja ../../docs/DEPLOYMENT.md. Os procedimentos futuros abaixo descrevem a preparação original, não autorização para reaplicação.

# Migrations — Etapa 002

Cinco arquivos criados por `supabase migration new` com CLI 2.81.3. Todos são novos nesta etapa; nenhum histórico Supabase aplicado anteriormente foi alterado. Foram elaborados e ensaiados em banco descartável, sem aplicação remota.

| Arquivo                                  | Responsabilidade                                                  |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `20261019205218_identity_tenants.sql`    | Identidade, contas e tenants; papel técnico privado.              |
| `20261019205219_members_scheduling.sql`  | Vínculos, convites, locais, partidas, presenças e auditoria.      |
| `20261019205220_security_invariants.sql` | Helpers privados, integridade, timestamps, owner e elegibilidade. |
| `20261019205221_administration.sql`      | Operações atômicas e wrappers públicos SECURITY INVOKER.          |
| `20261019205222_access_policies.sql`     | Ownership técnico, RLS, ACLs de tabela/coluna e EXECUTE mínimo.   |

## Revisão e validação antes de implantação

1. Ler docs/DATABASE.md e DECISIONS.md. Conferir permissões/constraints, as oito tabelas e o papel técnico app_executor.
2. Executar `npm run db:test` com Docker. Esse comando nunca usa conexão remota e não inicia a pilha Supabase completa.
3. Em instância Supabase local própria, executar `npx supabase start`, `npm run db:migrate:local` e `npx supabase migration list --local`.
4. Executar `npm run db:lint:local` e `npx supabase db advisors --local`; revisar os resultados, especialmente private não exposto, permissões de funções, RLS sem policy de cliente em convites e papel técnico sem login. Aviso de tabela deliberadamente inacessível deve ser analisado, não corrigido com policy permissiva.
5. Gerar tipos com `npm run db:types`. Testar também endpoints HTTP com JWTs de usuários de desenvolvimento, perfis, vários grupos e tokens revogados. Validar a versão alvo de PostgreSQL/extensões e os default privileges da pilha completa.
6. Revisar o estado/histórico de um ambiente de homologação explicitamente autorizado. Estas migrations assumem schema de aplicação vazio; não executar contra tabelas existentes com nomes iguais, nem usar IF NOT EXISTS para ocultar divergências.

Se for necessário reconstruir **somente seu banco local descartável**, `npx supabase db reset --local --no-seed` apaga/recria esse banco. Não usar --linked ou --db-url para esse comando no fluxo desta etapa.

## Aplicação remota futura, fora desta execução

Somente depois de autorização explícita para **homologação**, compatibilidade conferida e plano de backup/rollback revisado:

```sh
npx supabase link --project-ref <REF_DA_HOMOLOGACAO_AUTORIZADA>
npx supabase db push --linked --dry-run
# Revisar destino e a lista de migrations antes de qualquer escrita.
npx supabase db push --linked
```

Esses comandos são instruções futuras e não foram executados. Não aplicar no projeto de produção nesta etapa. O papel de migrations precisa poder criar app_executor e transferir ownership; somente postgres recebe membership técnico. Não conceder esse papel a anon/authenticated/authenticator. Não habilitar private nos schemas expostos e não configurar service role no frontend.

Não editar arquivos após passarem a compor um histórico aplicado e compartilhado. Correções posteriores serão migrations incrementais. Não há downgrade destrutivo automático nem seed real. O fluxo de eliminação de dados/histórico precisa ser aprovado antes da produção.
