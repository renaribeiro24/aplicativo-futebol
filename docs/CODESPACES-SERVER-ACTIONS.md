# Codespaces — origem das Server Actions (Next.js 16)

Correção preparada na develop em 27/10/2026, sobre a4a7eb6ae453699304bde8a2487c0078cd867671. Escopo: configuração local de desenvolvimento, sem alteração de Supabase/Auth, cookies, callbacks, migrations ou deploy.

## Diagnóstico

Cabeçalhos informados pelo responsável: x-forwarded-host identifica `refactored-space-tribble-6v4w4wj7p4vx36w6-3000.app.github.dev`, enquanto Origin tem host `localhost:3000` (reproduzido localmente com `Origin: http://localhost:3000`). Next.js 16.4.2 compara Origin.host (incluindo porta) com x-forwarded-host, preferindo este a Host. A divergência produz `Invalid Server Actions request` e POST /login 500 **antes de executar a ação**. Não é evidência de erro no Supabase ou de senha inválida.

O repositório não tinha next.config personalizado. A .devcontainer encaminha somente a porta 3000, sem rewrite de cabeçalhos. src/proxy.ts e src/lib/supabase/proxy.ts renovam sessão/cookies e aplicam guardas/cache; não sobrescrevem Origin ou x-forwarded-host. O proxy gerenciado do GitHub não está configurado por esses arquivos. Não foi possível inspecionar a sessão real do Codespaces; a causa imediata é sustentada pelos cabeçalhos relatados, pelo código instalado do Next e pela reprodução HTTP controlada abaixo. Não se atribui retrospectivamente a um componente específico do proxy a geração do Origin local.

## Correção mínima

next.config.ts exporta configuração por fase. A exceção só existe quando **todas** as condições forem atendidas:

- Fase PHASE_DEVELOPMENT_SERVER (next dev).
- CODESPACES exatamente true.
- CODESPACE_NAME válido como um único label DNS, com tamanho compatível com o sufixo -3000.
- Domínio de encaminhamento ausente (usa app.github.dev) ou exatamente app.github.dev.
- VERCEL ausente/vazio.

A configuração resultante contém:

```ts
{
  allowedDevOrigins: ["<CODESPACE_NAME>-3000.app.github.dev"],
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] }
  }
}
```

O placeholder acima é substituído pelo nome validado do Codespaces; não é wildcard. Nenhum host vem de cabeçalhos do request, parâmetros de URL ou entrada de usuário. Não há `*`, `**`, domínios Vercel ou domínio oficial nessa lista.

As duas opções têm finalidades diferentes:

- **allowedDevOrigins** permite assets/endpoints de desenvolvimento da origem exata do Codespaces e compara Origin.hostname (sem porta). Não corrige a validação CSRF de uma Server Action.
- **experimental.serverActions.allowedOrigins** compara **Origin.host**, não o host encaminhado. Por isso a única exceção necessária para os cabeçalhos relatados é localhost:3000. Colocar apenas o domínio público do Codespaces nessa lista não resolveria o caso. O fluxo same-origin continua aceito pelo comportamento padrão, sem nova exceção para ele.

next build, next start e demais fases retornam `{}` mesmo se as variáveis CODESPACES estiverem definidas. Fora do Codespaces, next dev também retorna `{}`. Em Vercel não se adiciona configuração. Variáveis inválidas falham fechadas, sem gerar listas mais amplas. A configuração só contempla a porta 3000 do projeto; outra porta exige evidência/revisão, não ampliação genérica.

A confiança em localhost:3000 é uma exceção CSRF real, limitada ao servidor dev do Codespaces. Código servido nessa origem é considerado confiável durante o desenvolvimento; manter a porta do Codespaces privada. Não se desabilitou a verificação do Next e nenhuma normalização artificial de Origin/Host foi adicionada ao proxy. Os guardas de sessão e autorização continuam necessários e inalterados.

## Evidências e limites da validação

- Testes unitários da configuração: modo dev Codespaces, fases de produção/teste, Vercel, variáveis ausentes/inválidas, domínio/nome malicioso e correspondência exata de porta. O matcher CSRF real do Next instalado é utilizado nos testes, não uma cópia simplificada dele.
- Reprodução local em http://127.0.0.1:3314, com variáveis de identificação do Codespaces simuladas e cabeçalhos do caso informado. Supabase não configurado, /api/me 503 confirmado antes dos POSTs; formulário real de /login e sua referência SSR de Server Action, sem enviar usuário/senha. Não usa conta, JWT, sessão ou banco remoto. A aceitação só foi considerada PASS quando o retorno da ação real de login indicou autenticação não configurada.

| Cenário HTTP                                        | Esperado / observado                                      | Resultado                           |
| --------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| Origin localhost:3000, forwarded host do Codespaces | 200; ação alcançada e indisponibilidade de Auth retornada | PASS                                |
| Origin igual ao forwarded host do Codespaces        | 200; ação alcançada pelo fluxo same-origin                | PASS                                |
| Origin evil.test                                    | 500; ação não alcançada                                   | PASS, proteção preservada           |
| Origin localhost:3001                               | 500; ação não alcançada                                   | PASS, porta diferente não permitida |
| Origin de outro Codespaces                          | 500; ação não alcançada                                   | PASS, sem wildcard                  |

500 nos três controles negativos é o comportamento atual do Next para bloqueio CSRF, não falha da ação. Relatório sanitizado: work/codespaces-origins-http.json; logs em work/codespaces-origins-{dev-webpack,http,lint,typecheck,unit,build}.log, ignorados pelo Git. Não foram gravados cookies, payloads de credenciais ou corpo completo das páginas no relatório.

A primeira tentativa de reprodução com Turbopack não compilou porque este executor compartilha node_modules por symlink fora da raiz. A reprodução HTTP usou `next dev --webpack`, sem alterar package.json ou configurar turbopack.root no produto. Essa limitação local não demonstra problema no Codespaces com npm ci normal. Não foi executada a infraestrutura GitHub real nem login com Supabase; esses dois pontos permanecem para validação pelo responsável.

| Verificação do repositório                                        | Resultado                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Lint                                                              | PASS                                                                          |
| Typecheck                                                         | PASS                                                                          |
| Vitest                                                            | 206 testes PASS em 17 arquivos, incluindo 29 novos casos de configuração/CSRF |
| Build Next.js 16.4.2 com CODESPACES=true e nome/domínio presentes | PASS                                                                          |
| Configuração serializada no build: origens extras de actions/dev  | Nenhuma, conferida no required-server-files.json                              |
| Reprodução HTTP local da fronteira de Server Actions              | 5 PASS; sem credenciais ou chamadas ao Supabase                               |
| Formatação dos arquivos alterados / diff --check                  | PASS                                                                          |
| Formatação global                                                 | FAIL preexistente nos dois documentos da Etapa 003.2, não alterados           |
| Login real no Codespaces / Preview Vercel                         | Não executado nesta sessão; seguir roteiro abaixo                             |

Relatório do build: work/codespaces-origins-production.json; não contém configuração completa nem secrets. A verificação confirmou listas extras vazias mesmo ao construir dentro de um ambiente identificado como Codespaces. Arquivos modificados: next.config.ts (novo), tests/next-config.test.ts (novo), este documento (novo) e README.md. Proxy da aplicação, devcontainer, Auth, variáveis de callback e dependências permaneceram intactos.

## Como validar no Codespaces

1. Na develop, preservar trabalho local, sincronizar por fetch e merge --ff-only, conferir o commit e instalar dependências pelo procedimento habitual. Não sobrescrever arquivos privados de ambiente.
2. Parar e reiniciar **o servidor next dev** depois de atualizar a configuração; não é necessário rebuild do container. Usar npm run dev na porta 3000. A configuração usa variáveis automáticas CODESPACES/CODESPACE_NAME; não as colocar em NEXT_PUBLIC_*.
3. Conferir somente os nomes não sensíveis CODESPACES, CODESPACE_NAME e GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN, caso a exceção não seja ativada. Valores ausentes/inválidos deixam a proteção padrão. Não imprimir o ambiente inteiro, cookies ou tokens.
4. Na aba Ports, manter a porta 3000 privada e abrir pelo link encaminhado do Codespaces. No navegador, conferir a origem realmente utilizada e limpar/recarregar a página para descartar referências antigas de Server Actions após restart. Não limpar indiscriminadamente sessões de outros ambientes.
5. Com a conta técnica já autorizada e secrets existentes, submeter o login. Confirmar que não reaparece o erro de divergência de origem e que a ação recebe a requisição. Erro de credenciais, rede/Auth ou URL de callback é diagnóstico separado; não ajustar Supabase remoto para contornar este erro do Next.
6. Se o login real concluir, conferir dashboard e logout. Não capturar HAR nem compartilhar bodies/headers completos; registrar apenas cenário, status, sucesso/falha e versão. Não declarar recuperação/callbacks PKCE homologados por esse teste.
7. Não adicionar localhost a configurações Vercel ou Supabase. A configuração de callback/NEXT_PUBLIC_SITE_URL é independente desta correção e não foi alterada. Não usar a exceção em next start; essa fase permanece com a política padrão.

## Referências verificadas

Documentação oficial distribuída com Next.js 16.4.2, conferida junto ao código do action-handler/csrf-protection:

- [serverActions.allowedOrigins](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions): lista de hosts adicionais, com porta quando existente, sob experimental.serverActions.
- [allowedDevOrigins](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins): lista separada de hostnames para assets/endpoints dev.

A lista de Server Actions também afeta produção se for configurada globalmente; por isso o isolamento por fase é obrigatório aqui. Nenhuma configuração de segurança foi relaxada em Preview/produção. A homologação Supabase 004.2-H permanece pendente e as evidências anteriores foram preservadas.
