# Integrantes — Incremento B

## Escopo e estado

Desenvolvimento controlado sobre o Incremento A (PR #2, `474d025`), em `feat/members-management`. Não integrado em develop/main, não aplicado remotamente. Não declarar esta implementação homologada com JWT real: o executor local está indisponível; a validação usa GitHub Actions e PostgreSQL descartável, sem rede e sem portas.

Somente gestão de integrantes permanentes, convites, solicitações, inativação/retorno, projeções e modalidade financeira existente. Incrementos C/D não iniciados: sem convidados por partida, eventos esportivos, vinculação de identidades, obrigações/isenções ou pagamentos.

## Modelagem e segurança

Migration nova `20261123204758_member_management.sql`, nome emitido pelo CLI 2.121.0 em execução isolada. A migration A e a 004.2-L são preservadas. L não é dependência de B; ambas as combinações são verificadas no banco descartável.

- Convites individuais estendem a tabela fechada existente. Novo fluxo só admite papel player, uso único, destinatário normalizado e confirmado. Expiram em 30 dias; geração de novo link revoga o pendente anterior. Links antigos sem destinatário não ingressam pelo novo fluxo. A criação legada sem destinatário falha explicitamente, mantendo assinatura para diagnóstico de compatibilidade.
- Links compartilháveis e solicitações ficam em tabelas private, sem grants cliente. Links não expiram; limite opcional, revogação explícita, uso incrementado somente na aprovação efetiva. Solicitações pendentes vencem em 30 dias e são deduplicadas por grupo/conta.
- Nova RPC pública `member_command` é SECURITY INVOKER; implementação privada restrita. Entradas verificadas, grupo bloqueado antes de decisões e atualizações, nenhuma confiança em papel/usuário fornecido pelo formulário.
- Contexto de admissão privado e vinculado à transação/ator/grupo/jogador autoriza exclusivamente o ingresso player/active e a classificação casual inicial. Clientes não podem criar esse contexto; não há flag GUC de bypass. Contexto removido ao concluir. Caminho antigo de reativação continua negado.
- Mesma identidade e mesmo vínculo são reutilizados no retorno, com novo período, sem restaurar privilégios. Convite já aceito não reativa um inativo.
- `participation_period_id` nullable acrescentado aos termos financeiros. Linhas legadas preservadas, sem backfill. Exclusão de sobreposição passa a considerar o período; NULL conserva a exclusão legada. Isso permite retorno no mesmo dia sem reescrever modalidade anterior.
- RPC de modalidade admite datas futuras, encerra a vigência atual aplicável e abre outra atomicamente; rejeita sobreposição. Não altera cobranças, não calcula pró-rata, não implementa substituição automática de políticas de preços. Vigências por data não representam mudanças de modalidade intradia.
- Sem DELETE cliente nas novas tabelas privadas. IDs de grupo/jogador/período validados por FKs compostas e guards existentes; escopo financeiro não é gravável diretamente pelo cliente.
- Projeção esportiva para membros permanentes ativos; gestores recebem inativos, contatos e filas. Contato é fotografia do e-mail confirmado no ingresso/solicitação, sem backfill nem acesso geral a Auth. Demais membros recebem somente modalidade própria, sem filas e sem contato alheio. Convidados/inativos/externos rejeitados.

### Exceção restrita à ponte Auth de A

A autorização de B exige conferir o e-mail confirmado da conta atual no banco. Acrescenta-se `private.member_verified_email()`, sem argumentos, SECURITY DEFINER de propriedade postgres, search_path vazio. Consulta somente `auth.uid()`, e-mail confirmado e conta não anônima. EXECUTE exclusivo de app_executor; clientes não a chamam. app_executor continua sem USAGE de auth e sem SELECT em auth.users. Não lê user_metadata para autorização e não permite enumerar usuários.

A regra anterior de “única ponte” de A passa a ter esta exceção explícita e testada; a ponte original não é alterada. A propriedade administrativa dessa nova função e a estrutura real de Auth são condições de futura revisão pré-aplicação, não autorização de execução remota.

## Interface

- `/groups/[slug]/members`: apresentação esportiva e detalhes de participação.
- `/groups/[slug]/settings/members`: painel de gestão, mantendo retorno à administração.
- Função, situação e modalidade são conceitos separados; filtros financeiros e contatos são administrativos.
- Criar/revogar convites, criar/revogar links, aprovar/recusar solicitações, inativar e promover/rebaixar conforme papel. Sem gestão do proprietário por admin.
- Sem schema B, a nova área mostra preparação e não simula persistência. Ações não disponíveis não geram sucesso.
- Nome/foto quando disponível, histórico de períodos e modalidades. Estatísticas por partida ficam para C, sem números fictícios.

## Tokens e entrega

32 bytes aleatórios por link, SHA-256 persistido; token bruto nunca vai ao banco ou auditoria. Hash em comparação exata, aceite explícito POST, GET sem consumo. URL usa fragmento `#token=` para não enviar o segredo no GET/referrer. Link retornado apenas na criação, sem recuperação posterior; copiar na hora. Gerar novamente revoga o convite individual pendente.

Login/cadastro abrem em outra aba, preservando o fragmento na aba original. Após confirmar a conta, voltar/recarregar e aceitar. Callbacks Auth/PKCE existentes permanecem intactos; não há redirect externo fornecido pelo usuário.

**Nenhum e-mail real é enviado.** Template BoraFute escapa conteúdo e usa origem validada. Adaptador ao vivo deliberadamente ausente; transporte injetável somente em teste. Opção automática cria registro `blocked/delivery_disabled` e informa claramente “nenhum e-mail enviado”, mantendo link manual.

Limite global por hash do destinatário normalizado: uma reserva automática por janela móvel de 24h, mesmo bloqueada/falha. Advisory lock e recibo idempotente impedem reservas concorrentes/retries. Compartilhamento manual não reserva nem reinicia o orçamento. Nenhuma chave Resend é lida. Aceitação do provedor em mock não é tratada como entrega.

## Retenção

Não há rotina remota/cron ativada. Validade pendente de 30 dias é aplicada nos fluxos; links compartilháveis continuam válidos até revogação. Anonimização de dados pessoais concluídos em seis meses e redução de logs mínimos em doze meses continuam como contrato para rotina futura, com revisão e autorização próprias. Não remover períodos, identidades ou histórico financeiro por essa limpeza.

## Testes e evidências

Resultados finais e links de execução serão acrescentados após a revisão isolada. Testes SQL usam sessões authenticated/anon reais do PostgreSQL com claims sintéticas, NÃO JWTs emitidos pelo Auth. Testes visuais são demonstração sintética explicitamente rotulada, com gravações desativadas; não equivalem à homologação autenticada hospedada.

## Limitações e homologação posterior

- Paridade remota de A/B/L, ownership da ponte e Advisors hospedados não consultados nem alterados nesta execução.
- JWT real, Auth completo, Data API HTTP e SSR autenticado contra esquema B pendentes em pilha Supabase isolada autorizada.
- Não ativar env de e-mail nem publicar mudanças em produção antes da revisão.
- Demonstração `/dev/members-preview` existe somente com NODE_ENV diferente de production e MEMBERS_UI_DEMO=1. Não consulta Supabase nem aceita gravações. Em build/next start a rota é not-found.
- Preservados dados, migrations anteriores, develop/main e branches A/operacional. Nenhum acesso ao Supabase remoto, envio Resend ou alteração administrativa foi realizado.
