# Integrantes — Incremento A — 23/11/2026

## Estado e limites

Base operacional preservada: fa88d9e55c8cbdb9ec77b4332daa0f6e3b074106, dez commits à frente de develop 667940c13324782cbc959fb7911f6809c9d0f913 e nenhum atrás. PR #1 continua Draft (develop → main). Branch específica: feat/members-foundation. Não há merge, produção ou aplicação de SQL remoto.

O ambiente gerenciado permanece em inicialização. Sua worktree não pôde ser inspecionada e não foi alterada nem descartada. Código obtido pelo GitHub na base exata, alterações somente na nova branch e testes em checkout limpo de runner isolado, sem secrets. Isso não comprova ausência de trabalho local não publicado.

Dados gerais já oculta coordenadas; os valores internos e mapa/navegação foram preservados na base, com 503 testes e quatro cenários visuais aprovados no run 45250545328. A análise nova não repete homologação remota.

## Decisões de arquitetura

- A-01: A não implementa convites, envio Resend, solicitações, convidados por partida, estatísticas ou obrigações financeiras. Não existe novo caminho de reativação até o aceite transacional do Incremento B. Essa indisponibilidade é intencional e fechada, não um retorno por alteração de status.
- A-02: member_participation_periods referencia a identidade composta do vínculo. Um período aberto por membro; intervalos não podem se sobrepor. Mudar papel permanente não cria outra identidade nem reinicia o período. Inativação fecha o período e registra ator, sem excluir vínculo, presenças ou classificação financeira.
- A-03: A instalação observará vínculos permanentes ativos com started_at igual ao momento de observação e source=observed_at_migration. Isso NÃO reconstrói o histórico anterior e não altera joined_at nem registros originais. Essa população da tabela nova deverá ser revisada e autorizada antes de aplicação remota, não executada silenciosamente.
- A-04: owner/admin/player ativos podem consultar informações esportivas autorizadas. Guest autenticado e inativo não podem ler grupo, elenco, agendas, preços, classificação ou presenças privadas. A exceção antiga de leitura do próprio vínculo inativo/guest é retirada. A conta e identidade global própria continuam acessíveis.
- A-05: list_member_profiles é wrapper público INVOKER com implementação privada que valida vínculo e filtros. Retorna somente apresentação esportiva e chave técnica do vínculo para ações; não retorna Auth IDs, contatos ou atores de auditoria. Inativos são consultáveis somente por gestores. Nenhum contato é copiado de Auth e nenhum grant em auth.users é acrescentado.
- A-06: SQL/grants e guardas SSR complementam-se. O dashboard filtra papéis permanentes; loadGroup recusa guest mesmo sobre esquema legado. O banco remoto NÃO recebe as policies corrigidas nesta entrega: sua proteção efetiva só pode ser afirmada após aplicação autorizada e homologação específica.
- A-07: Reutiliza lock do grupo antes de autorizar escrita e preserva a ordem partida → grupo no controle de presença. Índice de owner único e constraints existentes permanecem. Nenhuma credencial privilegiada simula usuário.
- A-08: Nenhuma migration aplicada anteriormente é editada. A migration A é independente da localização 004.2-L. O CLI oficial gera seu nome no runner isolado; nenhuma versão fictícia é atribuída ao histórico remoto.
- A-09: Não se migram classificações históricas, não se presumem Avulso, preços, pró-rata ou cancelamentos para registros legados. O início como player/casual no aceite, a pausa de geração de novas obrigações e os respectivos fluxos dependem de B/D; A prepara os períodos e bloqueia acesso de inativos, sem criar gerador de cobrança.
- A-10: A RPC antiga add_guest_once ainda é legado da Etapa 003 e não representa participação ocasional por partida. Sua adaptação pertence a C; A não a apresenta como funcionalidade nova de Integrantes. Conversão de guest em permanente por simples alteração de papel fica bloqueada.

## Mudanças de contratos

set_member_status mantém assinatura, mas deixa de reativar inativos. Não há flag GUC, user_metadata ou papel de cliente que desbloqueie retorno. set_member_role só promove jogador ativo a admin mediante owner; não converte vínculos guest/permanente. Transferência entre permanentes elegíveis preserva os fluxos existentes.

As suites legadas rodam primeiro contra o contrato anterior; a suite específica então aplica a migration e verifica os contratos novos e as regressões compatíveis. Isso evita tratar expectativas antigas de reativação como requisitos novos. A também é ensaiada em transação sobre as oito migrations sem L e revertida antes de seguir a suite.

## Testes e evidências

Aguardando execução do workflow específico. Não considerar fonte preparada como PASS.

Cobertura preparada: papéis autenticados SQL e anon, guest com conta, isolamento entre dois grupos, promoção, inativação, reativação direta recusada, conservação de presenças/classificação, projeção sem contatos/atores, imutabilidade, FK composta, sobreposição, rollback DDL e concorrência com gestor rebaixado. Claims sintéticas SQL NÃO são JWTs reais. Nenhuma conta técnica hospedada ou e-mail real é usado.

Runner cria somente PostgreSQL descartável com --network none, sem portas e sem URL de conexão fornecida pelo usuário. Bootstrap Auth é restrito aos testes e não entra na migration. Screenshot/relatórios somente com dados sintéticos.

## Aplicação futura e recuperação

NÃO APLICAR REMOTAMENTE. Antes de qualquer aplicação: confirmar projeto, reconciliar nomes locais/remotos, revisar backup restaurável, hashes, ownership, grants e policies; obter autorização específica. Não usar db push geral, pois a 004.2-L continua pendente e não autorizada.

A execução deve ser transacional. Falha antes do COMMIT exige ROLLBACK e inspeção, sem reparos automáticos. Após COMMIT, não executar DROP/reversão destrutiva: preservar períodos e obter plano compensatório revisado. Não reativar caminhos inseguros de status como forma de recuperação.

## Critério de revisão

Incremento A pode ser revisado com CI isolada aprovada e limitações registradas. Isso não equivale a homologação remota, conclusão da área Integrantes ou autorização de avançar ao Incremento B. Novas tabelas/RPCs ainda não usadas pelo cliente mantêm os tipos remotos atuais intactos; gerar tipos oficiais do esquema isolado validado antes de consumi-las na próxima UI.
