# Dados gerais e localização integrada — 13/11/2026

## Estado da entrega

Implementação local na `feat/stage0042-operational`, sobre `2470d33d613d57ef8a1378294d21d47839557615`. Sem commit, push, deploy, chamadas reais ao provedor ou alteração no Supabase hospedado. Não modifica as oito migrations aplicadas, RLS existente, Auth, registros existentes ou timezone. A migration L continua **NÃO APTA para aplicação remota** até nova auditoria e atendimento dos gates de recuperação e fronteira da Data API registrados em STAGE0042L.md.

A tela `/groups/[slug]/settings/general` mantém nome/descrição e reúne seleção de local existente, endereço manual, busca opcional, coordenadas e navegação. A gravação depende da migration L revisada: ausência das novas colunas desabilita salvar local, com aviso explícito. Falhas de autorização/rede não são tratadas como lista vazia ou sucesso. Não existe confirmação simulada de persistência.

## Contrato de localização e histórico

- Reutiliza `venues` e `groups.primary_venue_id`, sem tabela paralela de locais. Endereço livre legado `venues.address` não é interpretado, reformatado ou apagado.
- Campos estruturados opcionais: CEP, logradouro, número, complemento, bairro, cidade, UF. Principal exige nome e logradouro/cidade/UF **ou** nome e coordenadas válidas. Campos desconhecidos ficam nulos, nunca inventados. CEP informado tem oito dígitos; coordenadas são pareadas e limitadas a ±90/±180.
- Acrescenta latitude/longitude, `location_provider`, `external_place_id` e `superseded_at`, todos nullable e sem backfill. Provedor e ID externo são pareados; somente `geoapify` está previsto nesta versão.
- A RPC `save_group_primary_venue` é transacional: autorização owner/admin após lock do grupo; FK composta impede referência entre grupos; CAS do ponteiro e timestamp detecta edição concorrente. Nome/ID externo têm unicidade parcial nos locais atuais. Cadastro idêntico pode reutilizar um local atual do próprio grupo.
- Local sem uso pode ser atualizado. Alterar um local referenciado por agenda ou partida cria nova versão e muda somente o ponteiro principal. O registro anterior fica preservado como histórico, com referências e endereço livre intactos. A versão histórica não é oferecida em novas escolhas. Não há exclusão automática.
- Guardas congelam atributos de locais gerenciados já referenciados, e uma constraint trigger diferida impede principal histórico ao COMMIT. Escrita legada de nome/endereço de local ainda não estruturado mantém a compatibilidade anterior; passa pela versionagem quando adotado no fluxo gerenciado.
- Novas agendas **e inserções de partidas** sem `venue_id` recebem o principal; uma escolha explícita de local atual do próprio grupo prevalece. Sem principal, o campo continua opcional. UPDATE de agendas/partidas anteriores não recalcula o local. Esta entrega não cria módulo de cadastro de partidas: sua integração é no contrato de INSERT do banco, testado localmente.
- A assinatura da RPC ganhou quatro parâmetros opcionais após os doze anteriores. O arquivo L ainda não aplicado foi revisado; não há alteração de migration já aplicada. O hash anterior não aprova o SQL atual.

## Segurança

Página, loader, Server Action e endpoint de busca verificam sessão/vínculo/owner ou admin no servidor. Grupo é derivado do contexto autorizado, não de um campo oculto. Player/guest não recebem operações administrativas. A RPC e FKs repetem a proteção no banco. Nenhum grant direto dos novos campos é concedido aos clientes; wrapper público INVOKER delega a implementação privada com autorização explícita. Nenhuma chave privilegiada representa usuário.

Busca: `POST /api/groups/[slug]/locations/search`, JSON, sessão real e vínculo gestor, `private, no-store`. Destino HTTPS fixo, sem redirects, timeout de quatro segundos, consulta de 3–200 caracteres, resposta limitada a 100 KB, pedido limitado a 1 KB, no máximo seis sugestões. Não devolve corpo de erro do provedor, URL com chave ou dados de credenciais. Orçamento em memória de 12 buscas/minuto por usuário/instância **não é um limite global distribuído**: configurar cotas/alertas de gasto na conta do provedor antes de ativar.

Somente a chave no servidor é usada; não há variável NEXT_PUBLIC para mapas. O mapa OSM é carregado apenas após clicar em Visualizar mapa; o link de navegação usa origem fixa Google Maps sem SDK/chave. A busca informa o envio do texto ao provedor. Ao editar endereço selecionado, coordenadas/identificação derivadas são invalidadas quando necessário. Sugestões não salvam nada automaticamente.

## Escolha do serviço e decisão antes de ativar

| Opção             | Avaliação                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Geoapify          | Adapter preparado para autocomplete de endereço/nome, Brasil, em português. A documentação permite armazenamento/reutilização conforme termos e atribuição. Referência de plano gratuito: 3.000 créditos/dia; uma busca autocomplete consome um crédito. Confirmar plano, limites e termos vigentes antes de contratar/ativar. |
| Google Places     | Boa cobertura de estabelecimentos, mas requer projeto/chave e eventual faturamento; restrições de armazenamento de conteúdo diferem da persistência permanente pretendida. Place IDs possuem exceção própria. Não adotado sem revisão contratual e de retenção.                                                                |
| Mapbox            | Persistência exige modo/permissão de geocoding permanente adequado; não ativado.                                                                                                                                                                                                                                               |
| Nominatim público | Política proíbe autocomplete; não utilizado como alternativa gratuita irrestrita.                                                                                                                                                                                                                                              |

Para reduzir ambiguidade de atribuição/armazenamento, o adapter aceita nesta versão apenas resultados Geoapify identificados como fonte OpenStreetMap e mostra atribuições Geoapify/OSM. Fontes desconhecidas são omitidas; cobertura de estabelecimentos pode ser menor. O usuário sempre pode preencher manualmente. A qualidade/cobertura real do provedor ainda não foi homologada.

**Decisão necessária:** aprovar provedor, termos de armazenamento/atribuição e orçamento. Depois, configurar `GEOAPIFY_API_KEY` somente em secret do servidor e `GEOAPIFY_STORAGE_APPROVED=1` no ambiente autorizado. Os placeholders de `.env.example` não ativam o serviço. Nenhuma conta, contratação, chave, quota ou variável remota foi criada/alterada nesta tarefa. Busca desativada ou indisponível mantém o formulário manual utilizável quando o esquema estiver disponível.

Fontes oficiais consultadas:

- <https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/>
- <https://www.geoapify.com/geocoding-api/>
- <https://www.geoapify.com/pricing/>
- <https://www.geoapify.com/pricing-details/>
- <https://developers.google.com/maps/documentation/places/web-service/policies>
- <https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/>
- <https://operations.osmfoundation.org/policies/nominatim/>

## Tipos e validações executadas

Tipos futuros em `src/types/database.location.types.ts`, gerados oficialmente pelo Supabase CLI 2.121.0 **depois** de aplicar/verificar o SQL em PostgreSQL descartável. `createClient` permite optar pelo contrato futuro apenas nos novos caminhos; o Database atual/default não foi substituído. O artefato anterior `tests/database/generated/stage0042l.database.types.ts` é snapshot da preparação original, não o contrato runtime revisado.

| Verificação                                                         | Resultado / alcance                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL local                                                           | PASS: 70 assertions de segurança anteriores, 109 da 004.2, 10 de settings e 68 da L revisada. Sessões authenticated/anon com claims sintéticas; **não equivalem a Auth/JWT HTTP real**.                                                                                                                                                                                                       |
| Concorrência/rollback local                                         | PASS: concorrentes de criação/edição com CAS, revalidação de gestor após lock, resolução de principal em INSERT concorrente, conflito de arquivamento abortado sem principal inativo, rollback DDL/RPC, dados legados preservados e gates de drift. Possível deadlock com escrita direta legada é abortado pelo PostgreSQL e apresentado como conflito, sem retry automático.                 |
| Unitários e integração de contrato                                  | PASS: 494 testes totais; inclui validação, loader, Server Action com transporte SDK sintético, API autorizada/não autorizada, respostas malformadas, indisponibilidade e formulário. Não há JWT real ou provedor real nestes testes.                                                                                                                                                          |
| Lint / typecheck / build                                            | PASS. Build otimizado local; não é deploy.                                                                                                                                                                                                                                                                                                                                                    |
| Layout isolado                                                      | PASS em seis combinações desktop/tablet/celular × claro/escuro; sem overflow, campos/submit presentes, timezone ausente, foco inicial verificável. HTML SSR do formulário com dados sintéticos e ActionForm substituído para exportação; **não é navegação privada autenticada nem teste de hidratação/combobox**. Evidências locais ignoradas: `work/location-visual/report.json` e imagens. |
| Formatação                                                          | PASS nos arquivos desta entrega. `npm run format:check` global aponta duas falhas preexistentes em `docs/STAGE0032.md` e `docs/STAGE0032-UI-CHECKLIST.md`, preservadas fora do escopo.                                                                                                                                                                                                        |
| JWT/Data API real, busca real, persistência remota e UI autenticada | NÃO EXECUTADOS: migration revisada não autorizada/aplicada, credenciais técnicas não disponíveis neste executor, provedor não ativado.                                                                                                                                                                                                                                                        |

Evidências locais ignoradas: `work/location-unit.log`, `location-lint.log`, `location-types.log`, `location-build.log`, `location-sql.log`. Nenhum log privado, fixture real ou arquivo de work é parte da entrega.

## Próximos passos e Preview

1. Rever a migration revisada, obter prova de recuperação e confirmar `private` fora da Data API conforme STAGE0042L. Não aplicar automaticamente.
2. Autorizar transferência/publicação em branch de homologação, sem develop/main/Production. Não publicar código dependente de novo esquema como se estivesse homologado.
3. Após autorização específica de aplicação, verificar metadados e executar JWT/Data API real com contas sintéticas, owner/admin/player/guest/outro grupo; preservar legados, versões e eventos anteriores. Validar o fluxo de edição/seleção e override das agendas.
4. Se aprovado o provedor, ativar somente no ambiente autorizado e homologar sugestões, fallback, atribuição, mapa por clique, teclado e concorrência. Não preencher endereço incompleto com dados artificiais.

**Não existe Preview desta alteração local.** O Preview conhecido de `2470d33` é anterior e não comprova esta entrega: <https://aplicativo-futebol-iu1fvj11o-renan-ribeiros-projects.vercel.app>. Nenhum alias/deployment foi alterado.

## Transferência autorizada — 16/11/2026

O responsável autorizou commit/push exclusivamente na branch de homologação e a preparação de Preview. Foi acrescentada demonstração isolada, claramente sem persistência, em `/homologacao/localizacao`, disponível somente no Preview desta branch. Isso substitui a limitação histórica de ausência de demonstração navegável, sem alterar o parecer NÃO APTO da migration nem ativar Geoapify. Consulte [roteiro do Preview](LOCATION-PREVIEW.md).
