# Tipos compartilhados

`database.types.ts` foi gerado oficialmente por introspecção do projeto de desenvolvimento `hpbvtqvbtyioqjyelrpb` usando Supabase MCP em 10/11/2026. Apenas formatação Prettier foi aplicada à saída. Os clientes browser/server/proxy usam `Database` como genérico. Não editar esse contrato à mão.

Para regenerar a partir do mesmo projeto, use `generate_typescript_types` do MCP autenticado. Alternativamente, com CLI autenticado: `npx supabase gen types typescript --project-id hpbvtqvbtyioqjyelrpb --schema public`; grave a saída somente após sucesso e execute typecheck. Nenhuma credencial deve ir ao arquivo gerado.

`npm run db:types` continua restrito à instância local e grava atomicamente após sucesso. Não usar tipos de um banco local divergente para substituir os tipos de desenvolvimento sem conferir as migrations. Na Etapa 003 os tipos foram regenerados depois da sétima migration e incluem ensure_my_identity, save_my_identity, create_group_once e add_guest_once.

Na Etapa 004.2-K, a introspecção oficial inclui também `group_schedules`, `group_pricing_policies` e `member_billing_terms`, após a oitava migration (versão remota `20261029191222`). A geração não aplicou mudanças ao banco.

## Contrato opt-in de localização (migration ainda não aplicada remotamente)

`database.location.types.ts` foi gerado pelo CLI oficial 2.121.0 após aplicação e testes do SQL L revisado em PostgreSQL descartável local. É usado explicitamente somente nos novos caminhos de localização, com verificação de disponibilidade do esquema. Não substitui `database.types.ts` nem comprova homologação remota. Regeneração local restrita: `STAGE0042L_GENERATE_TYPES=1 npm run db:test`. Consulte [contrato de localização](../../docs/GROUP-LOCATION.md).
