# Em Campo — fundação do aplicativo de futebol

Aplicação web responsiva em português brasileiro para evoluir o gerenciamento de futebol amador e society. **Em Campo é um nome provisório.** O 4ª Força será o primeiro grupo, sem ser a marca global do produto. A aplicação foi projetada para múltiplos grupos independentes e múltiplos papéis por pessoa.

A Etapa 003 implementa autenticação, recuperação de senha, dashboard, grupos, convidados e perfil com persistência no Supabase de desenvolvimento. Sete migrations estão aplicadas, com tipos oficiais integrados. **A homologação ponta a ponta permanece pendente:** o executor Codex não alcança a API HTTP do Supabase; SQL remoto e testes locais passaram. Roteiro, rotas e configuração de Auth/SMTP em [docs/STAGE003.md](docs/STAGE003.md). Preview Vercel implantado; nenhum dado real foi criado.

## Requisitos e stack

- Node.js 24.x e npm 11.x (Node 24 inclui npm compatível; `.nvmrc` disponível).
- Next.js 16.4.2 App Router, React 19.3.1 e TypeScript 6.0.3 strict.
- Tailwind CSS 4.3.3, componentes shadcn/ui locais, Supabase JS 2.118.0 e SSR 0.12.7.
- ESLint 9.39.5, Vitest 5.0.5, Prettier 3.9.10 e Supabase CLI 2.121.0 (devDependency).
- Dependências exatas no package.json e resolução reproduzível no package-lock.json. TypeScript 7 anterior não atendia à faixa do parser de lint; ESLint 10 não atendia aos peers dos plugins do eslint-config-next. A linha ESLint 9 é a combinação compatível atual usada aqui; npm emite aviso de fim de suporte dessa linha. Atualizar o conjunto de plugins assim que suportar ESLint 10 é uma pendência de ferramentas, não silenciar peers ou usar --force.

As referências consultadas e decisões estão em `docs/ARCHITECTURE.md` e `docs/DECISIONS.md`.

## Instalação e execução local

Na raiz do checkout:

```sh
nvm use                  # se usar nvm
npm ci
npm run dev
```

Abra http://localhost:3000. A interface e o build funcionam **sem .env.local**. Login/cadastro ficam desabilitados, o dashboard exibe configuração pendente e a API de identidade responde 503. Isso não representa uma sessão ou um banco de demonstração.

Para produção local, após o build:

```sh
npm run build
npm start
```

Não há script de deploy, conexão automática de projeto, bootstrap de banco nem SQL executado na instalação.

## GitHub Codespaces

Abra o repositório em **Code → Codespaces → Create codespace**. A configuração `.devcontainer/devcontainer.json` usa imagem Node 24, executa `npm ci` e encaminha a porta 3000. A Etapa 002 adiciona Docker-in-Docker para testes locais de banco; faça rebuild do container para habilitar a feature. Execute `npm run dev` no terminal e abra a porta pelo painel Ports. O servidor escuta `0.0.0.0` para permitir o encaminhamento. Mantenha a porta privada durante o desenvolvimento.

O devcontainer não copia credenciais, não executa migrations e não inicia Supabase automaticamente. A imagem Dev Container não foi construída/testada nesta execução; os mesmos comandos npm foram verificados no ambiente Node 24 disponível.

## Supabase: configuração local, opcional para a interface

Para conectar o desenvolvimento autorizado, configure somente no ambiente local ignorado:

```sh
cp .env.example .env.local
```

Preencha localmente:

| Variável                             | Uso                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL             | Origem HTTPS do seu projeto; aceita HTTP apenas em localhost para Supabase local                  |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Chave moderna `sb_publishable_...`; nenhuma secret/service_role é aceita                          |
| NEXT_PUBLIC_SITE_URL                 | Origem confiável do aplicativo, sem caminho; localhost no desenvolvimento e HTTPS em outros hosts |

Reinicie o servidor após alterar variáveis. Não envie arquivos .env ao Git. NEXT_PUBLIC_ é incluído no bundle do navegador: jamais usar credenciais privilegiadas. Esta base usa somente a chave publicável; Auth/RLS deverão limitar operações. Não gera chave nem consulta banco no setup.

A configuração real depende de: provedor Email habilitado, confirmação de e-mail, URL do site e redirect permitido `/auth/callback` no Supabase, SMTP para entrega em produção e revisão de limites do Auth. No Codespaces, usar a origem HTTPS encaminhada exata como NEXT_PUBLIC_SITE_URL e permitir o callback correspondente no projeto de desenvolvimento. Não usar wildcard amplo de redirect. O callback PKCE exige o mesmo navegador que iniciou o cadastro. O template padrão de confirmação deve preservar `{{ .ConfirmationURL }}`.

O arquivo `.env.local` da implementação anterior foi preservado em `work/previous.env.local`, ignorado e fora do carregamento automático. Não foi restaurado nem usado nas verificações desta etapa. Não é necessário recuperá-lo para desenvolver a fundação.

## Rotas e estado real

| Rota                    | Sem Supabase configurado                        | Com Supabase configurado                                    |
| ----------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `/`                     | Página pública                                  | Página pública                                              |
| `/login`, `/signup`     | Aviso e formulário desabilitado                 | Estrutura de e-mail/senha preservada, depende de Auth       |
| `/dashboard`            | Somente aviso de preparação; sem dados privados | Exige getUser válido no servidor e mostra painel provisório |
| `/api/me`               | 503 JSON, sem chamar Auth                       | 401 sem usuário; 200 com ID/e-mail do usuário validado      |
| `/auth/callback`        | Retorna à página de login com erro              | Troca código PKCE por sessão; destino fixo `/dashboard`     |
| `/manifest.webmanifest` | Manifesto PWA                                   | Manifesto PWA                                               |

O proxy renova cookies e evita cache de sessão. O painel e API têm guardas próprios. Nenhum grupo, jogador ou partida é consultado nesta entrega. Nenhum tipo Database fictício foi criado. Alterar papel pelo frontend ou user_metadata nunca será fonte de autorização.

## Estrutura principal

```text
.devcontainer/devcontainer.json
.env.example
.nvmrc
AGENTS.md
README.md
components.json
eslint.config.mjs
postcss.config.mjs
vitest.config.mts
package.json / package-lock.json
tsconfig.json
public/icons/                 # SVG e PNGs provisórios
src/
  app/
    (public)/                 # layout, início, login e signup
    (protected)/              # layout reservado e dashboard provisório
    api/me/route.ts
    auth/callback/route.ts
    layout.tsx
    loading.tsx
    error.tsx
    not-found.tsx
    manifest.ts
    globals.css
  components/
    layout/                   # marca provisória, navegação, shell e aviso
    ui/                       # button, card, badge, input, skeleton, alert
  features/
    auth/                     # ações, formulário, sessão e validação
    groups/types.ts           # vocabulário de papéis, sem CRUD
  lib/
    supabase/                 # config, browser, server e refresh no proxy
    utils.ts
  types/                      # contratos comuns; sem tipos de banco inventados
  proxy.ts
supabase/config.toml          # somente ambiente local; private não é exposto
supabase/migrations/          # cinco migrations novas; sem aplicação remota
scripts/
  test-database.mjs           # PostgreSQL descartável, sem rede/portas
  generate-database-types.mjs # CLI oficial, somente --local
tests/                        # testes Vitest da aplicação
  database/                  # SQL de fixtures e segurança sob papéis não privilegiados
docs/
  PRODUCT.md
  ARCHITECTURE.md
  DATABASE.md
  DECISIONS.md
  VERIFICATION.md
work/                         # ignorado; material temporário e cópia anterior
```

Não há camadas repository/service genéricas. Componentes do shadcn são mantidos como código local, com licença MIT e origem documentada em `src/components/ui/README.md`.

## Comandos de qualidade

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

`npm run check` reúne lint, tipos, testes e build. `npm run test:watch` acompanha testes em desenvolvimento; `npm run format` aplica formatação. Os testes unitários usam mocks explícitos e dados sintéticos. Não fazem chamadas a um projeto real e não substituem testes de RLS, SMTP ou sessões reais. Consulte `docs/VERIFICATION.md` para resultados executados e limites.

## PWA e tema

Manifesto com pt-BR, modo standalone e ícones provisórios 192/512, maskable e Apple. Sem service worker, cache de dados privados ou sincronização offline. Isso prepara evolução, sem afirmar instalabilidade completa. HTTPS será necessário fora de localhost. Cores semânticas e raio estão em `src/app/globals.css`; modo escuro segue o sistema. Nome e identidade ainda são provisórios, sem marca fixa de grupo.

## Banco local, RLS e geração de tipos

Para testar o banco sem credenciais, com Docker Linux disponível:

```sh
npm run db:test
```

O comando cria seu próprio PostgreSQL 17.6 fixado por digest, sem portas publicadas e sem rede, aplica as migrations em ordem, testa isolamento/constraints/rollback, onboarding, idempotência e três corridas concorrentes, e remove o container mesmo em falha. O Docker pode precisar baixar a imagem. Não aceita URL, nome de projeto ou credenciais remotos. Fixtures são sintéticas e não são seeds da aplicação. O contrato de Auth desse ensaio é mínimo: não equivale à pilha Supabase completa.

Para validar posteriormente na pilha **Supabase local**, usando instância de desenvolvimento própria:

```sh
npx supabase start
npm run db:migrate:local
npx supabase migration list --local
npm run db:lint:local
npx supabase db advisors --local
npm run db:types
```

Todos os comandos acima são locais. `db:types` chama o gerador oficial com `--local --schema public` e grava atomicamente `src/types/database.types.ts` apenas se a introspecção tiver sucesso. Os tipos oficiais do projeto remoto já foram gerados e aplicados aos clientes browser/server/proxy. `npm run db:types` permanece local; veja `src/types/README.md` para regeneração remota. A UI usa Auth e as APIs tipadas de domínio. Não substituir tipos gerados por interfaces manuais.

As migrations e o procedimento de revisão estão em `supabase/migrations/README.md`. O teste local não presume tabelas remotas existentes; migrations falharão diante de colisões de nomes, em vez de sobrescrever tabelas. Não há script de deploy ou aplicação remota.

## Próxima etapa

Homologar a Etapa 003 com Auth, e-mail e JWTs reais seguindo `docs/STAGE003.md`; revisar os avisos de segurança e as decisões de privacidade antes de produção. Ainda faltam o aceite de convites, reivindicação segura de convidados, anonimização/retenção, promoção transacional da espera e Storage. Preview Vercel disponível com homologação funcional pendente. O estado da implantação de desenvolvimento e suas pendências estão em `docs/DEPLOYMENT.md`.

## Preview Vercel — Etapa 003.1

**Implantação concluída; homologação permanece pendente.** [Abrir Preview de develop](https://aplicativo-futebol-git-develop-renan-ribeiros-projects.vercel.app), protegido por Vercel Authentication.

Projeto exclusivo aplicativo-futebol, ID `prj_F4qeSw3UsqZzXj5cA89XSY5PgGnt`, na equipe autorizada renan-ribeiros-projects. Repositório vinculado, produção main e Preview develop; Next.js/Node 24, npm ci e npm run build. Build READY e respostas HTTPS públicas verificadas. As três variáveis estão somente em Preview, com Supabase de desenvolvimento e origem do alias estável.

Configuração Auth/SMTP e confirmação/login/grupos/convidados reais ainda precisam de homologação com duas contas fictícias. Callbacks exatos, impacto sobre Codespaces, auditoria e incidente de deploy cancelado estão em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md); evidências em [docs/VERIFICATION.md](docs/VERIFICATION.md). PR #1 permanece em rascunho, sem merge.
