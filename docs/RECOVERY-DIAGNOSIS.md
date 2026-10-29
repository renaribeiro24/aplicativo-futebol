# Recuperação de senha — diagnóstico de 21/10/2026

## Resultado

Foi corrigido o tratamento que classificava qualquer falha de callback como link expirado. O callback também passou a encaminhar o identificador de fluxo PKCE do SDK quando ele existe. **A recuperação real não está homologada e não foi demonstrada a eliminação de todas as causas de bad_code_verifier.** É necessário um novo ensaio controlado com definição de senha e login.

Fonte inspecionada: develop@18123d856686fcf3ff42c9c47b5b20f8014d4c14. Nenhuma alteração em main, banco, credenciais, confirmação de e-mail, template ou configuração administrativa Supabase. O alias www deve apontar ao Preview deste commit antes de testar.

## Evidências e limites da causa

As evidências fornecidas pelo proprietário mostram envio 200, verificação /auth/v1/verify, retorno a /auth/callback?flow=recovery, autenticação numa primeira abertura e One-time token not found em abertura posterior. O consumo de um token de uso único explica uma segunda abertura recusada; não identifica quem o consumiu.

A consulta de logs Auth por MCP, na janela padrão das últimas 24 horas, encontrou dois POSTs grant_type=pkce com bad_code_verifier, três GETs com One-time token not found e um erro de limite de envio. A consulta projetou somente categorias e contagens; não retornou e-mails, IPs, URLs completas, tokens ou códigos. O campo path dessa fonte veio normalizado como /; portanto os agregados não correlacionam os dois erros PKCE a uma pessoa ou a um pedido específico de recuperação. Não atribuir todos os eventos a este fluxo sem nova evidência.

O SDK instalado escreve verificadores por fluxo e também um cookie de compatibilidade compartilhado. Sem identificador no callback, a troca lê o verificador do último fluxo iniciado. Teste com createServerClient real e Auth sintético reproduziu a incompatibilidade ao iniciar dois pedidos e abrir o primeiro link. Isso demonstra um mecanismo possível, **não prova concorrência nas tentativas reais**. O mesmo SDK funcionou com um pedido isolado e manteve o verificador em cookies até a troca.

Scanners, rastreamento de links Resend, múltiplos cliques e pedidos concorrentes continuam hipóteses para consumo/sobrescrita. Não foi demonstrado que um scanner é responsável. Não foi habilitado bypass, verificação sem PKCE ou aceitação de sessão prévia em substituição ao código válido.

## Caminho do fluxo inspecionado

1. /forgot-password renderiza AuthForm, que chama a Server Action requestPasswordReset.
2. A ação usa createClient de src/lib/supabase/server.ts, baseado em @supabase/ssr/createServerClient. resetPasswordForEmail recebe redirectTo fixo = NEXT_PUBLIC_SITE_URL + /auth/callback?flow=recovery.
3. SDK gera desafio/verificador e escreve o verificador antes de enviar o pedido. O adapter SSR chama cookies.setAll mesmo sem evento de login. A Server Action pode gravar os cookies; um HTTP 200 da ação sozinho não prova que o usuário abriu o link com esses cookies.
4. Cliente SSR no callback recebe os cookies da requisição e executa exchangeCodeForSession. detectSessionInUrl=false no servidor; o proxy faz getUser/refresh, não troca automaticamente o code.
5. Sucesso aponta para /reset-password. A página exige usuário validado por getUser. A ação resetPassword valida senha/confirmação, revalida usuário e chama updateUser({password}); somente sucesso vai ao dashboard.
6. Nenhuma rota nova, concessão de privilégio ou alteração da lógica de login/logout foi introduzida.

Origem canônica: https://www.borafute.com.br. Iniciar e concluir no mesmo navegador/origem. www, raiz e alias vercel.app não compartilham automaticamente os cookies de host. A regra do SDK é path=/, SameSite=Lax, sem Domain, httpOnly=false para compatibilidade do cliente browser. O adapter atual não define Secure explicitamente; não foi alterado nesta correção. HTTPS/HSTS não torna esse atributo automaticamente true. Não mudar para SameSite=None, Domain compartilhado ou remover PKCE para contornar uma falha.

O código do cliente de servidor tolera gravação impossível em Server Components, onde o proxy persiste refresh; recuperação é Server Action e callback é Route Handler, ambos graváveis. Não foi detectada perda de cookie num pedido isolado no ensaio do adapter. Ainda falta observar Set-Cookie e cookies enviados pelo navegador real, sem copiar seus valores para logs.

## Correção aplicada

- Classificação fechada por códigos conhecidos: bad_code_verifier/pkce_code_verifier_not_found → context; otp_expired/flow_state_not_found/flow_state_expired → expired; formato ausente/incompatível → invalid; erro de serviço/desconhecido → unavailable.
- Mensagens finais são genéricas e orientam um novo pedido no mesmo navegador, usando somente o e-mail mais recente. Falha de serviço deixou de ser anunciada como expiração.
- Log de aplicação contém somente evento auth_callback_recovery_failed e uma das quatro categorias fixas. Não loga Error, provider message, URL, query, token, code, verificador, e-mail ou senha.
- error/error_code retornados pelo provedor são tratados antes de consumir code. error_description nunca é exibida/logada. Fragmentos de URL não chegam ao servidor: links de fluxo implicit não foram aceitos nem convertidos.
- token_hash/type não acionam verifyOtp automaticamente no fluxo de recuperação. O contrato atual continua code/PKCE; payloads incompatíveis falham fechados.
- sb_flow_id é o nome real do parâmetro no SDK fixado. Quando presente e válido, é encaminhado como {flowId} a exchangeCodeForSession. Um identificador inválido falha antes da troca; não há tentativa com outro verificador. URLs sem identificador continuam compatíveis.
- Não se considera sucesso apenas por existir uma sessão anterior. Reutilização de código falha mesmo quando getUser poderia retornar usuário válido.
- Cache-Control private/no-store e destinos fixos de confirmação/dashboard/reset foram mantidos; nenhum redirecionamento externo é aceito.

## O que esta mudança não faz

A geração automática de sb_flow_id pelo SDK é experimental e está desabilitada por padrão. **Não foi ativada.** Logo, o encaminhamento corrigido protege callbacks que já tragam esse identificador, mas não cria correlação para e-mails antigos ou pedidos que não o carreguem. Não afirmar que esse ajuste sozinho elimina a sobrescrita entre pedidos sem identificador.

Para ativar correlação automaticamente seria necessário revisar Site URL/allowlist e habilitar appendPkceFlowIdToRedirects no cliente que inicia recuperação. A própria documentação do SDK avisa que allowlists exatas incluem query e podem rejeitar o novo parâmetro, levando ao fallback Site URL. Redirecionamentos para a própria origem da Site URL são aceitos segundo o SDK; a configuração real deve ser conferida primeiro. Não ampliar curingas nem alterar a confirmação de cadastro para obter um teste aprovado. Esse passo ficou pendente de acesso/configuração confirmada, sem alteração administrativa às cegas.

A correção também não ressuscita um token consumido, não identifica quem abriu o link e não revoga sessões existentes.

## Template Supabase/Resend e scanners

O MCP disponível não oferece leitura/gestão da configuração Auth/SMTP/templates. O template real de recuperação não foi inspecionado nem substituído. Solicitação feita ao proprietário: Site URL atual e somente o href do template, nunca o e-mail recebido ou um token.

Para o contrato existente, o href de recuperação deve usar {{ .ConfirmationURL }} e preservar o redirect enviado pelo SDK. RedirectTo ou SiteURL sozinhos pulam a verificação. Não configurar token_hash com /auth/confirm: essa rota não existe. Callbacks esperados:

- https://www.borafute.com.br/auth/callback
- https://www.borafute.com.br/auth/callback?flow=recovery

Conferir no painel Resend se rastreamento altera o link e, no provedor da caixa controlada, se há prefetch/scanner. Fazer um pedido, sem reenvios, e abrir uma única vez manualmente. Um GET ao endpoint Supabase verify pode consumir o token de e-mail antes da troca PKCE. Uma tela intermediária com confirmação via POST e template token_hash seria outra arquitetura, com mudança administrativa e testes próprios; não foi adotada sem causa demonstrada.

## Testes e homologação pendente

A suíte automatizada cobre sucesso/falha/reutilização de callback, recusa de formato incompatível e erros do provedor, ausência de verificador, sobrescrita após segundo pedido, correlação explícita por fluxo e cookies do adapter SSR. O teste de SDK usa transporte Auth inteiramente sintético; as fixtures não representam conta ou token real.

A ação de definição de senha continua coberta por usuário verificado, confirmação divergente, sessão expirada e sucesso em updateUser com SDK simulado. Esse ensaio não prova mudança de senha no Supabase.

Antes de declarar homologação:

1. Conferir Site URL, allowlist, template e rastreamento, sem expor o link.
2. Em um único navegador no www e com alias atualizado, iniciar um pedido fictício. Não iniciar outro cadastro/pedido/reenvio até concluí-lo.
3. Observar somente presença/atributos do cookie verificador e resposta Set-Cookie; não registrar valores.
4. Abrir o e-mail mais recente uma única vez, confirmar chegada a /reset-password com sessão válida.
5. Salvar nova senha, sair e efetuar login com ela. Confirmar que a antiga não funciona quando aplicável.
6. Reabrir o mesmo link: deve falhar sem atualizar senha nem usar sessão anterior como autorização substituta.
7. Testar navegador diferente, cookies apagados e solicitações concorrentes separadamente; correlacionar horários/categorias, nunca tokens.
8. Se bad_code_verifier persistir no pedido isolado, parar e inspecionar cookies/origens do navegador real; não repetir automaticamente troca de código nem declarar scanners como causa.

Validação local em Node 24/npm 11: lint e typecheck passaram; 10 arquivos e 70 testes passaram; build Next.js webpack passou. Formatação e git diff --check conferidos. Os testes não usaram rede, usuário real ou SMTP. A instalação de dependências existente foi reutilizada; o ensaio anterior havia instalado o lockfile sem scripts por limitação no download do CLI Supabase. Resultados da implantação são registrados na entrega. Até completar definição de senha e login reais, o fluxo segue **não homologado**.
