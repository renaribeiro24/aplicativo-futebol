# Preview de localização — preparação em 16/11/2026

## Publicação autorizada e escopo

Transferência exclusivamente na branch `feat/stage0042-operational`, partindo de `2470d33d613d57ef8a1378294d21d47839557615`. O responsável autorizou commit, push e Preview de homologação. `develop` e `main` não são destinos desta entrega. Não há aplicação remota de SQL, alteração administrativa, produção, domínio/DNS, contratação ou ativação Geoapify.

A migration L revisada integra o código versionado para revisão/testes locais; publicar seu arquivo não a executa. Não há workflow em `.github/`; os scripts de build revisados não executam migrations. Parecer da migration permanece **NÃO APTO para aplicação remota**. O plano de recuperação e os gates de STAGE0042L continuam válidos.

## Duas experiências distintas

### Aplicação autenticada

`/groups/[slug]/settings/general` conserva as permissões e a persistência existente de nome/descrição. O local principal está bloqueado automaticamente quando faltam as novas colunas da migration L. Nenhuma resposta de sucesso é apresentada nesse caso; erros de autorização/rede continuam erros. Não testar submissões sobre grupos reais como parte desta entrega.

### Demonstração isolada

`/homologacao/localizacao` existe **somente** quando `VERCEL_ENV=preview` e `VERCEL_GIT_COMMIT_REF=feat/stage0042-operational`. Em Production, development ou qualquer outra branch responde not-found. Não requer conta BoraFute e não contorna autenticação de páginas privadas. A proteção de acesso da Vercel permanece preservada.

É possível editar rascunhos de nome/descrição e localização, validar CEP/UF/coordenadas, inspecionar o resultado e abrir mapa/navegação. Os campos do endereço e a validação são compartilhados com o fluxo real. A identificação do grupo nesta página é apenas rascunho visual e não prova atualização real.

**Não há persistência:** sem Supabase, Auth, RPC, cookies de sessão, localStorage ou gravação de rascunho no servidor. A confirmação diz “Rascunho validado nesta aba. Não gravado no banco.” Recarregar ou limpar descarta o estado. Nenhuma lista de locais reais, agendas ou partidas é consultada. Usar somente dados fictícios. A demonstração não comprova autorização por perfil ou integração de persistência.

Busca de estabelecimentos fica desativada de forma explícita; não há sugestões fictícias. Mapa OSM só carrega após clicar, e navegação Google Maps usa link externo sem SDK/chave. Esses cliques enviam o endereço/coordenadas ao respectivo serviço; não são feitos automaticamente nos testes. Não existe custo de Geoapify nesta demonstração nem chave embutida.

## Auditoria pré-publicação

- Remoto `renaribeiro24/aplicativo-futebol`; branch de homologação remota conferida sem divergência da base.
- Projeto Vercel `aplicativo-futebol`, `prj_F4qeSw3UsqZzXj5cA89XSY5PgGnt`, equipe `team_ZCVh2SDJPkrBvec05vrO0RTO`; Git correto vinculado. Deployments anteriores desta branch são Preview.
- Variáveis Supabase/URL presentes separadamente em Preview e Production. Somente nomes/escopos utilizados na revisão; nenhuma credencial real faz parte do patch. Não há variáveis Geoapify cadastradas no projeto.
- Deployment Protection mantém Vercel Authentication; nenhum domínio/alias ou regra de proteção foi alterado para liberar o Preview.
- Arquivos ignorados de `work/`, configurações locais `.env`, credenciais, relatórios privados e registros reais não entram no commit.

## Validação e limitações

Resultados desta transferência serão consolidados no relatório final e nos logs locais ignorados `work/location-transfer-*.log`. Testes SQL são exclusivamente em PostgreSQL descartável sem rede externa; não equivalem a JWT/Data API real. Os testes de navegador da demonstração não consultam o banco e verificam ausência de requisições de gravação/provedor, campos, erros, descarte do estado e responsividade.

A formatação global pode continuar apontando `docs/STAGE0032.md` e `docs/STAGE0032-UI-CHECKLIST.md`, falhas preexistentes fora do escopo. Os arquivos desta entrega devem passar individualmente.

Depois do push, conferir commit, target Preview e estado READY do deployment antes de distribuir o endereço. O endereço e o ID efetivos serão entregues no relatório ao responsável; não inferir que o domínio oficial acompanha esta branch. Nenhum commit de atualização de documento é necessário para disparar novo deployment apenas para registrar o deployment anterior.

## Resultados locais desta transferência

- Lint, typecheck e build otimizado: **PASS**.
- Testes de aplicação: **501 PASS**, 34 arquivos; sete casos adicionais cobrem isolamento/identificação da demonstração e bloqueio por ambiente/branch.
- SQL local: **PASS** nas regressões anteriores (70 assertions de segurança, 109 da 004.2, 10 de settings) e nas **68 assertions da L**, além de concorrência, CAS, rollback e preservação de legado. Nenhum banco remoto utilizado.
- Navegador com página Next.js hidratada: **6/6 PASS**, desktop/tablet/celular × claro/escuro. Validou erro de endereço incompleto, CEP inválido, rascunho válido, links de navegação, mapa não carregado automaticamente, descarte ao recarregar, ausência de overflow/erros JS e **zero requisições de gravação ou ao provedor**.
- A mesma página em servidor local com ambiente Production resultou em not-found, sem formulário de demonstração. Next.js pode transmitir not-found com HTTP 200 e marcador `NEXT_HTTP_ERROR_FALLBACK;404`; esse status isolado não libera a demonstração.
- Formatação dos arquivos da entrega e `git diff --check`: **PASS**. Formatação global mantém apenas as duas falhas documentais preexistentes citadas acima.
- Evidências locais ignoradas: `work/location-transfer-visual/report.json`, imagens, logs `work/location-transfer-*.log`. Nenhum desses artefatos entra no commit.
- Homologação JWT/Data API da nova migration, persistência remota e busca real: **NÃO EXECUTADAS**, deliberadamente fora desta autorização.
