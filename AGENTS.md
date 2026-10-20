# Instruções permanentes para agentes

## Produto e escopo

Leia README.md e docs/PRODUCT.md, ARCHITECTURE.md, DATABASE.md e DECISIONS.md antes de mudar o domínio. Este repositório é uma fundação multi-tenant de futebol amador/society. O 4ª Força é um futuro grupo, nunca a identidade global. Não criar funcionalidades, dados ou integrações simuladas fora do pedido.

## Código

- Next.js App Router em src/app, TypeScript strict, React Server Components como padrão.
- UI reutilizável em src/components/ui; estrutura visual em src/components/layout; módulos em src/features; infraestrutura Supabase em src/lib/supabase; tipos compartilhados em src/types.
- Alias @/* aponta para src/*. Não reintroduzir app/ ou lib/ na raiz.
- Evitar any, abstrações genéricas sem necessidade e dependências desnecessárias. Validar entradas no servidor. Não criar Database fictício.
- Tailwind com tokens semânticos; manter mobile-first, pt-BR, foco visível, labels, hierarquia de títulos e estados acessíveis.
- Componentes shadcn/ui são código local sob MIT; preservar a licença e os atributos de acessibilidade.

## Segurança

- Nunca inserir secrets/service_role, JWTs reais ou senhas em código, testes, logs, documentação ou NEXT_PUBLIC_. .env.example deve ter placeholders vazios para Supabase.
- Não ler/dumpar arquivos de credenciais para investigação. work/ contém material anterior local e ignorado; não publicar ou comitar essa pasta.
- Configuração ausente deve falhar fechada: sem usuários fictícios, sem bypass de sessão. O aviso de preparação não deve renderizar dados privados.
- getUser no servidor para sessão; verificar cada página, ação ou API sensível. Não confiar em user_metadata, presença de cookie, frontend ou tenant vindo da URL.
- Manter cookies de refresh e Cache-Control private, no-store em respostas de autenticação, incluindo redirects. Sem ISR/cache global de sessão.
- Tenancy via vínculo ativo no grupo. UPDATE requer USING e WITH CHECK, além de restrições para campos imutáveis. FKs compostas devem impedir referências entre grupos.
- Não criar RLS permissiva genérica. Revisar recursão, SECURITY DEFINER e privilégios explícitos. Proteger Storage por identidade/vínculo e manter buckets privados quando o conteúdo for privado.

## Banco, serviços e autorização

O schema da Etapa 002 está implementado em migrations novas e testado somente em PostgreSQL descartável. Não presumir que tabelas existam ou sejam compatíveis no projeto remoto. Não executar SQL remoto, db push, migrations, deploy, provisionamento, buckets ou dados reais sem instrução explícita para essa etapa. A autorização para uma tarefa prevalece; não pedir confirmações extras para leituras ou trabalho local reversível autorizado.

Futuras migrations devem ser criadas pelo CLI (consultar --help), revisadas e testadas localmente com RLS/tenancy antes de qualquer aplicação remota. Tipos Database só após o schema existir e ser verificado. Não habilitar offline privado ou sincronização sem revisão de logout e troca de tenant.

## Ferramentas e verificação

- Node 24, npm 11; usar npm ci e manter package-lock.json. Fixar versões de novas dependências e verificar compatibilidade real de peers.
- Usar rg para buscar. Scripts/rascunhos temporários em work/; testes permanentes em tests/.
- Executar npm run format:check, npm run lint, npm run typecheck, npm test e npm run build nas mudanças relevantes. Reportar exatamente o que foi executado e suas limitações.
- Mocks são permitidos em testes, nunca como integração funcional no produto. Testes unitários não provam RLS/SMTP ou Auth real.
- Preservar trabalho existente, inspecionar git status e explicar conflitos. Não comitar, enviar alterações, publicar ou fazer deploy sem solicitação.
- Atualizar decisões pendentes e documentação quando contratos de arquitetura ou segurança mudarem.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Banco da Etapa 002

- Execute `npm run db:test` para testes SQL: o runner cria e destrói seu próprio PostgreSQL local sem rede/portas e nunca usa URL remota. Não reutilizar esse bootstrap de Auth em migrations reais.
- RLS de clientes deve ser testado com session_user/current_user authenticated ou anon, nunca só com service_role/postgres. Checagens privilegiadas de invariantes devem ficar separadas e identificadas.
- Preserve owner único ativo, lock de grupo antes de autorizar mudanças de vínculo e lock partida → grupo para presença. Não criar escrita livre de papel/status/user_id/group_id.
- app_executor não pode ter login/BYPASSRLS ou associação com papéis de cliente. private não pode ser exposto pelo PostgREST; wrappers públicos permanecem SECURITY INVOKER.
- Convites não expõem hash e não têm aceite público. Não adicionar claim de convidado sem prova/consentimento e nova decisão revisada.
- `npm run db:types` usa exclusivamente Supabase local. Tipos oficiais de desenvolvimento já foram gerados por MCP e aplicados aos clientes; ver src/types/README.md. Não preencher Database à mão.
- Cinco migrations já foram aplicadas ao desenvolvimento por MCP; versões remotas diferem dos nomes locais. Conferir supabase/development-migrations.json e docs/DEPLOYMENT.md antes de qualquer push SQL. Não reaplicar. A correção adicional em docs/proposals é apenas proposta e não faz parte das migrations autorizadas.
