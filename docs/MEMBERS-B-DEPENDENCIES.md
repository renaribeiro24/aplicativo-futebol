# Dependências — Integrantes B

Auditoria de 23/11/2026 no runner isolado: **15 pacotes afetados, 14 moderados e 1 alto; nenhum crítico.** Com `--omit=dev`: **1 moderado (Next.js)**. Contagem de pacotes não é contagem de CVEs. Nenhuma dependência/lockfile alterada neste incremento.

| Pacote instalado | Severidade | Alcance | Caminho e tratamento proposto |
| --- | --- | --- | --- |
| @hono/node-server 2.1.5 | Moderada | Desenvolvimento | shadcn → @modelcontextprotocol/sdk → @hono/node-server; corrigido >=2.1.6. Não iniciar servidor MCP/HTTP de tooling em interface pública. |
| @ts-morph/common 0.27.0 | Moderada | Desenvolvimento | shadcn → ts-morph → @ts-morph/common → minimatch; corrigir upstream, não aceitar downgrade shadcn 1.0.0 sugerido pelo audit. |
| @typescript-eslint/eslint-plugin 8.72.0 | Moderada | Desenvolvimento | eslint-config-next → typescript-eslint → @typescript-eslint/eslint-plugin → estree/utils → minimatch. Alerta transitivo; atualizar conjunto compatível, sem --force. |
| @typescript-eslint/parser 8.72.0 | Moderada | Desenvolvimento | eslint-config-next → typescript-eslint → @typescript-eslint/parser → estree/utils → minimatch. Alerta transitivo; atualizar conjunto compatível, sem --force. |
| @typescript-eslint/type-utils 8.72.0 | Moderada | Desenvolvimento | eslint-config-next → typescript-eslint → @typescript-eslint/type-utils → estree/utils → minimatch. Alerta transitivo; atualizar conjunto compatível, sem --force. |
| @typescript-eslint/typescript-estree 8.72.0 | Moderada | Desenvolvimento | eslint-config-next → typescript-eslint → @typescript-eslint/typescript-estree → estree/utils → minimatch. Alerta transitivo; atualizar conjunto compatível, sem --force. |
| @typescript-eslint/utils 8.72.0 | Moderada | Desenvolvimento | eslint-config-next → typescript-eslint → @typescript-eslint/utils → estree/utils → minimatch. Alerta transitivo; atualizar conjunto compatível, sem --force. |
| body-parser 2.3.0 | Alta | Desenvolvimento | shadcn → @modelcontextprotocol/sdk → express → body-parser; corrigido >=2.4.0. Alto: DoS por corpo comprimido. Não é dependência runtime da aplicação Next. |
| fast-uri 3.1.8 | Moderada | Desenvolvimento | shadcn → SDK/conf/ajv-formats → ajv → fast-uri; corrigido >=3.1.9. Validadores de ferramentas, sem input remoto no build controlado. |
| hono 4.13.13 | Moderada | Desenvolvimento | shadcn → @modelcontextprotocol/sdk → hono; corrigido >=4.13.16. Não expor servidores de tooling, não usar em rotas do aplicativo. |
| minimatch 10.2.6, 10.2.6 | Moderada | Desenvolvimento | eslint/plugins/typescript-eslint e shadcn → ts-morph; corrigido >=11.0.1 implica revisar compatibilidade major transitiva. Apenas padrões do repositório confiável no CI. |
| next 16.4.2 | Moderada | Produção | runtime direto 16.4.2; audit propõe 16.4.6, sem major. Revisar/atualizar junto a eslint-config-next e repetir Auth/SSR/Server Actions/build. Não presumir ausência de exposição apenas por severidade moderada. |
| shadcn 4.22.1 | Moderada | Desenvolvimento | CLI de desenvolvimento → ts-morph/SDK; fix sugerido pelo audit é downgrade 1.0.0 incompatível, não aplicado. |
| ts-morph 26.0.0 | Moderada | Desenvolvimento | shadcn → ts-morph → common → minimatch; correção upstream/compatibilidade major ainda deve ser validada. |
| typescript-eslint 8.72.0 | Moderada | Desenvolvimento | eslint-config-next → typescript-eslint → estree/minimatch; correção compatível da cadeia ESLint a validar. |

## Impacto efetivo e decisão

O pacote alto body-parser está marcado dev no lock e não aparece no audit de produção. O aplicativo não importa express/Hono/SDK/shadcn em suas rotas. O risco permanece para processos de tooling se expostos a requisições não confiáveis; CI não inicia esses servidores e usa dados sintéticos. Revisar antes de expor ferramentas/atualizar lock; não é aceite automático do proprietário.

Next.js possui avisos de cache entre usuários, SVG, Edge headers e repasse de respostas. O código deste incremento não habilita Cache Components/use cache/unstable_cache, não usa runtime Edge nem encaminha respostas arbitrárias; avatar usa Image unoptimized, sem otimização SVG. Isso reduz caminhos específicos, mas NÃO comprova imunidade do runtime inteiro ou de outras rotas. A correção 16.4.6 deve ser tratada separadamente com regressões antes de futura publicação. Não afirmar que todos os 15 avisos são apenas de desenvolvimento.

Condição de revisão: antes de integrar/publicar B e a cada atualização da cadeia de ferramentas. Sem npm audit fix --force, sem downgrade, sem supressão dos avisos. Relatório npm audit completo está nos logs da execução isolada; URLs individuais dos advisories estão disponíveis na saída JSON. Nenhum aceite de risco residual foi presumido.
