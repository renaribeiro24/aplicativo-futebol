# Produto

Plataforma web responsiva em português brasileiro para organizar grupos de futebol amador e society. Em Campo é um nome provisório. O 4ª Força é somente um futuro tenant, sem marca ou privilégios globais; nenhum dado real foi criado.

Uma conta pode participar de vários grupos com papéis diferentes. O perfil de acesso é privado ao usuário. Nome esportivo, apelido e posição da identidade global são compartilhados somente com grupos autorizados. Convidados sem conta pertencem ao grupo de origem e não podem ser associados automaticamente a contas pelo nome/e-mail.

## Etapa 003 implementada, aguardando homologação

- Cadastro, confirmação e reenvio de e-mail, login, logout, recuperação e redefinição de senha via Supabase Auth real.
- Preparação atômica e repetível do perfil e jogador global; edição própria de apresentação e atributos esportivos.
- Dashboard com saudação, grupos ativos do usuário, papel por grupo e estado vazio.
- Criação de grupo com slug editável, descrição e fuso, proprietário único e operação transacional.
- Página privada do grupo, contagem de vínculos ativos, elenco paginado e cadastro administrativo de convidados com posição.
- Interface neutra, móvel e desktop, claro/escuro, mensagens e formulários acessíveis. Manifesto/ícones PWA existentes sem cache offline privado.

Persistência SQL foi testada no desenvolvimento. Cadastro/e-mail/recuperação e navegação autenticada completa ainda precisam de homologação real no Codespaces: o executor Codex não alcança a API HTTPS pelo proxy. Implementação não significa Auth/SMTP homologados. Consulte STAGE003.md.

## Próximos módulos, fora desta entrega

Aceite público de convites; saída/arquivamento e gestão de papéis na UI; reivindicação consentida de convidados; locais, agenda e presença na interface; promoção de espera; Storage com políticas específicas; estatísticas, rankings, campeonatos, cobrança e pagamentos. Nenhuma tela dessas funcionalidades foi apresentada como disponível.

## Decisões de produto ainda abertas

Nome/marca; retenção e anonimização; consentimento e reivindicação de convidados; políticas de elenco e privacidade; espera e cancelamento; regras esportivas e financeiras; limites de planos; personalização por grupo e política de uploads. O modelo atual mantém exatamente um proprietário ativo, sem permitir autoelevação nem gestão do proprietário por admin. Recibos de submissão são técnicos e privados; sua retenção será definida antes de produção.
