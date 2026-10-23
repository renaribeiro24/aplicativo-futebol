# Tipos compartilhados

`database.types.ts` foi gerado oficialmente por introspecção do projeto de desenvolvimento `hpbvtqvbtyioqjyelrpb` usando Supabase MCP em 20/10/2026. Apenas formatação Prettier foi aplicada à saída. Os clientes browser/server/proxy usam `Database` como genérico. Não editar esse contrato à mão.

Para regenerar a partir do mesmo projeto, use `generate_typescript_types` do MCP autenticado. Alternativamente, com CLI autenticado: `npx supabase gen types typescript --project-id hpbvtqvbtyioqjyelrpb --schema public`; grave a saída somente após sucesso e execute typecheck. Nenhuma credencial deve ir ao arquivo gerado.

`npm run db:types` continua restrito à instância local e grava atomicamente após sucesso. Não usar tipos de um banco local divergente para substituir os tipos de desenvolvimento sem conferir as migrations. Na Etapa 003 os tipos foram regenerados depois da sétima migration e incluem ensure_my_identity, save_my_identity, create_group_once e add_guest_once.
