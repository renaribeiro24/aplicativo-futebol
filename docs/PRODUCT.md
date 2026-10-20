# Produto

## Visão

Aplicação web responsiva, em português brasileiro, para organizar grupos de futebol amador e society. Referências de mercado: Chega+ e Appito. O primeiro grupo previsto é o **4ª Força**, mas ele será um tenant comum, sem privilégios ou identidade visual globais. Nenhum dado desse grupo foi criado.

**Em Campo** é um nome provisório para a interface, não uma decisão final de marca. Cores e tipografia usam tokens CSS; cada grupo poderá receber personalização em uma etapa futura.

## Pessoas e contextos

- Uma conta autenticada pode organizar um grupo e ser participante de outro.
- Um vínculo entre jogador e grupo concede acesso à conta vinculada; papéis são locais ao grupo.
- Jogadores vinculados a uma conta têm identidade esportiva global, compartilhada apenas com grupos autorizados. Convidados sem conta são restritos ao grupo de origem; sua vinculação futura exigirá consentimento e prova de autorização.
- O sistema não deduz acesso de um jogador pelo nome, e-mail digitado ou metadados editáveis.

## Fundação entregue

Página inicial, navegação pública, layouts público e reservado, dashboard provisório, estados de carregamento/erro, componentes UI, clientes Supabase, limites de sessão, configuração opcional de ambiente, manifesto e ícones PWA, ambiente Codespaces, testes e documentação. Fluxos de e-mail/senha preexistentes foram preservados como estrutura; não foram testados com um projeto real nesta execução.

## Módulos previstos, ainda não implementados

| Etapa proposta | Módulo                                                       | Dependência                                                 |
| -------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Próxima        | Banco, RLS, autenticação validada, perfis, grupos e vínculos | Revisão do esquema e projeto de desenvolvimento configurado |
| Posterior      | Convites, jogadores convidados e locais                      | Vínculos e permissões testados                              |
| Posterior      | Partidas e confirmação de presença                           | Grupos, jogadores e locais                                  |
| Futuro         | Rankings, campeonatos, estatísticas                          | Regras esportivas aprovadas                                 |
| Futuro         | Mensalidades, pagamentos, notificações                       | Requisitos financeiros e provedores definidos               |
| Futuro         | PWA com experiência offline seletiva                         | Modelo de privacidade e invalidação aprovado                |

O dashboard não apresenta contagens, grupos, pessoas ou resultados simulados. Os módulos futuros não têm botões que sugiram operações disponíveis.

## Fora do escopo atual

Telas de CRUD de domínio, criação do 4ª Força, aplicação remota de migrations, criação de buckets, deploy, pagamentos e sincronização offline. Não existe seleção de grupo ativa até o cadastro de grupos ser implementado.

## Questões de produto em aberto

Nome e marca; possibilidade de múltiplos proprietários; visibilidade do elenco entre membros; processo de reivindicação de jogador convidado; política de privacidade e retenção; confirmação de presença e cancelamento; regras de faltas; limites por plano e cobrança. Nenhuma dessas decisões será inferida de referências de mercado.

## Etapa 002 — banco versionado

Cinco migrations implementam entidades, RLS e operações administrativas, com testes SQL locais. Nenhuma tela administrativa, aceite público de convite ou consulta de dados de domínio foi adicionada à UI. As cinco migrations foram implantadas no desenvolvimento; uma incompatibilidade de acesso ao schema Auth bloqueia RPCs até correção adicional. Detalhes e limites em DATABASE.md e VERIFICATION.md.
