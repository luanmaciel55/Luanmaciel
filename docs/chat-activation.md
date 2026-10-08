# LM conversas — ativação do /chat

Implementação preparada em 08/10/2026. **Ainda não ativada em produção.**

## O que está implementado

- Rota `/chat`, fora dos menus e do bloqueio geral do site, com `noindex`.
- Cadastro de nome, e-mail, celular brasileiro com DDD (ou internacional com `+`) e senha de 8–128 caracteres. Não envia confirmação por e-mail/SMS. Telefones/e-mails são declarados, não verificados.
- Login por e-mail ou telefone; sessão independente do painel administrativo.
- Busca exata de contato por telefone/e-mail; lista pessoal e conversas individuais.
- Texto em tempo real via Supabase Realtime, emojis e 20 SVGs originais.
- Áudio de até 2 minutos/5 MB, prévia antes de enviar, Storage privado e URLs assinadas de 1 hora.
- Chamadas de voz WebRTC, aceitar/recusar, desligar, silenciar e sinalização privada. Ambos devem manter o chat aberto. Não há push/chamadas com o site fechado.
- Temas claro, escuro, rosa e oceano salvos no aparelho.
- Bloqueio bilateral do envio e formulário de denúncia (armazenada para análise manual no banco).

## Bloqueios observados

1. Vercel: listar projetos funcionou, mas `get_project` para `luanmaciel` na equipe `team_ZQyWNODBzViGqQxIKZtS36S8` retornou **403 / Not authorized / scope soliup**. CLI sem credenciais disponível.
2. Supabase: `get_project` e consulta de metadados em `buxevihtjiialecfhkhy` retornaram **You do not have permission to perform this action**.
3. Não foram executadas migrações remotas nem gravadas variáveis de produção. O código foi preparado em branch separado; não foi feito merge/publicação.

## Passos para concluir quando o acesso for restabelecido

1. Confirmar que a Vercel aponta `luanmaciel` para `luanmaciel55/Luanmaciel` e identificar o commit atual de produção.
2. Inspecionar schema, políticas RLS e políticas de Storage existentes. Políticas permissivas genéricas de outros buckets não podem liberar `chat-audio`. Verificar também a política administrativa `is_site_admin` e garantir que contas comuns do chat nunca recebem privilégios do site.
3. Aplicar `supabase/migrations/20261008020515_mobile_chat.sql` ao projeto correto e executar advisors. É uma migração aditiva que não desativa confirmação global do Auth e não altera tabelas existentes.
4. Configurar na Vercel, com escopo apropriado:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave pública)
   - `SUPABASE_SERVICE_ROLE_KEY` (segredo apenas no servidor)
   - `CHAT_TURN_URL` e `CHAT_TURN_SECRET` para um relay coturn compatível com credenciais temporárias HMAC-SHA1. Sem relay, WebRTC usa STUN, e algumas redes móveis/NAT/firewalls não conectam. Ainda não foi provisionado serviço pago.
5. Usar ambiente de teste separado para preview. Conferir a origem do IP de `x-vercel-forwarded-for` no ambiente Vercel; fora dele, o código usa um limite local compartilhado. Verificar cabeçalhos e limites distribuídos antes de produção.
6. Testar com três contas descartáveis em navegador e celulares: cadastro sem OTP, ambos os logins, contatos, texto bidirecional, emoji/20 figurinhas, gravação Safari e Chrome, áudio privado, reconexão, bloqueio, denúncia e chamadas em Wi-Fi e 4G com relay. Testar câmera não é necessário: chamada é somente de voz. Confirmar negação de acesso da terceira conta diretamente na API.
7. Conferir no navegador a interface móvel e ausência do link nos menus, além da preservação das páginas do site.
8. Publicar somente após a ativação e os testes reais, verificar logs e testar `/chat` na URL final.

## Verificação local

- `npm ci`
- `npm run test:chat`: executa a migração em Postgres local via PGlite; testa RLS com três identidades, isolamento de e-mails/telefones, RPCs restritas, remetente falso, campos inválidos, figurinhas, Storage privado, bloqueio, ciclo de chamada, ICE, limites e acesso anônimo.
- `npx tsc --noEmit`
- `npm run build`

Esses testes não substituem GoTrue/Auth, Storage real, Realtime e chamadas entre dois dispositivos. Os testes locais usam schemas mínimos de Auth/Storage apenas para validar SQL/RLS.

## Operação e limitações

- Senhas ficam no Supabase Auth. A API usa `createUser` com liberação imediata somente para contas novas; nunca confirma ou altera uma conta administrativa existente. E-mails já cadastrados não podem ser apropriados pelo chat.
- E-mail/telefone não verificados não provam identidade. Não exibir selo de verificado nem permitir recuperação automática apenas pela posse declarada de um telefone.
- Contas já existentes no Auth e sem perfil do chat não são inscritas automaticamente. Uma futura vinculação deve exigir autenticação da conta existente.
- Não há recuperação de senha, edição de contato, grupos, chamadas de vídeo ou notificações push nesta versão.
- Mensagens não usam criptografia de ponta a ponta. RLS restringe o acesso, e operadores do serviço podem ter acesso administrativo.
- Retenção/exclusão de contas, áudios órfãos e denúncias exige operação do responsável. Antes de uso amplo, definir rotina de limpeza de ICE/chamadas antigas e arquivos órfãos, exclusão de conta e análise de denúncias. Não foi criada tarefa que apague dados automaticamente.
- `chat_messages` limita 60 envios/minuto por usuário; chamadas limitam 5 inícios/minuto; ICE limita 200 candidatos/chamada. Login/cadastro/adição de contato têm limites distribuídos no Postgres.
- O RLS proíbe leitura pública, mas `noindex` e ausência de menus não tornam a rota secreta.

A tela pública de login/cadastro foi renderizada em Chromium a 390 px, sem rolagem horizontal e sem erros de JavaScript. A requisição ao servidor foi verificada para exibir um aviso quando a configuração ainda não existe. Testes com dados fictícios de interface não representam ativação ou validação de mensagens/chamadas reais.

A interface autenticada também foi exercitada com respostas de API fictícias: envio/renderização de texto, seletor com exatamente 20 figurinhas, retorno à lista e troca de tema. Sem erros de JavaScript ou transbordamento horizontal a 390 px. O teste de cadastro sem variáveis retornou o aviso esperado de ativação pendente (HTTP 503).
