# E-mails, recuperação e documentos

Esta etapa foi preparada em `feat/email-privacidade`, na pasta `estagio-flow-acesso`. A avaliação experimental permanece sem commit na pasta e branch originais. As migrations de avaliação e desta etapa são independentes, ambas baseadas na main que já contém cronograma. Não aplique a migration experimental da avaliação sem confirmar sua metodologia.

## Configurar Resend

O envio real depende de conta Resend, domínio/remetente verificado e origem pública HTTPS do frontend. As credenciais ficam apenas no .env local ou secrets da hospedagem:

Na hospedagem, configure NODE_ENV=production para ativar as verificações de configuração produtiva. Não publique o servidor de demonstração.

- EMAIL_MODE=resend.
- RESEND_API_KEY: chave restrita ao envio, fornecida pelo painel do provedor.
- EMAIL_FROM: endereço do remetente verificado.
- PUBLIC_APP_URL: origem HTTPS exata do frontend, sem caminho, query, fragmento ou credenciais. A API não usa cabeçalhos Host enviados pelo cliente para gerar links.
- EMAIL_ENCRYPTION_KEY: chave AES de 32 bytes em hexadecimal, gerada separadamente da JWT_SECRET. Mantenha-a estável enquanto houver mensagens pendentes; rotação requer tratamento da fila existente.

O backend não exige SDK adicional. Usa POST https://api.resend.com/emails, texto simples e Idempotency-Key estável por mensagem, conforme a [documentação oficial](https://resend.com/docs/api-reference/emails/send-email). Aceite do provedor não confirma entrega na caixa postal: monitoramento de rejeições/bounces e webhooks é uma ampliação futura.

Convites individuais, reemissões e importações enfileiram mensagens dentro da mesma transação do cadastro. A coordenação ainda recebe o link manual e a indicação de envio agendado. Sem configuração, EMAIL_MODE=disabled mantém o compartilhamento manual; recuperação informa indisponibilidade sem consultar se o endereço existe.

## Fila e operação

O servidor processa a fila a cada cinco segundos, sem enviar durante a transação do cadastro. O payload contém somente destinatário, assunto e texto com link, cifrado com AES-256-GCM; tokens em claro não ficam na fila. Após envio ou encerramento, o payload cifrado é removido. Não envie dados acadêmicos nos e-mails de acesso.

Até cinco tentativas com espera crescente e timeout de dez segundos. Claim com FOR UPDATE SKIP LOCKED; locks abandonados são recuperados após dois minutos. Referências expiradas, revogadas, usadas ou de conta desativada são canceladas antes do envio. Há limite conservador de 23 horas desde a criação para não ultrapassar a janela de idempotência do provedor em repetições. Pausas longas podem exigir reemitir o convite ou pedir outra recuperação. Falhas têm códigos genéricos; não registramos corpo da resposta, credenciais ou links no log.

EMAIL_MODE=capture e a caixa pública de demonstração exigem ambiente não produtivo e conexão de banco local. DEMO_EMAIL_INBOX=true é usado somente pelo helper que cria contas fictícias no PGlite. A caixa mantém no máximo 100 mensagens em memória e não existe em produção ou no modo de envio real. Nunca habilite captura com dados reais, mesmo em banco local.

## Recuperação

POST /auth/recuperacao recebe email. Para envio habilitado, a resposta 202 e seu texto são iguais para conta existente, inexistente, pendente ou desativada; nenhum token é devolvido. Há espera mínima de 250ms para reduzir diferenças usuais de tempo, sem promessa de tempo constante para rede/banco, limite por IP, cinco pedidos por e-mail a cada 15 minutos e supressão de reenvio em 60 segundos.

O token aleatório de 32 bytes tem hash SHA-256 no banco, validade de 30 minutos e uso único. Um novo pedido permitido revoga tokens anteriores. POST /auth/recuperacao/redefinir recebe token e senha de 12 a 128 caracteres; bloqueia a conta na transação, confere validade/ativação, consome o token, troca o hash e incrementa a versão de sessão. A troca não faz login automático. A desativação invalida a recuperação enquanto a conta permanecer desativada; direitos anteriores não são ampliados pelo fluxo.

Links usam fragmento #recuperacao=token ou #convite=token, removido da barra ao carregar o frontend, sem envio do token na URL HTTP ou referrer. A prévia abre links de e-mail em uma nova aba para inicializar o fluxo corretamente. Tokens existentes em memória desaparecem ao recarregar; use novamente o link recebido se necessário.

## Termos e privacidade

Não há declaração de conformidade automática com a LGPD. Existem bases legais além do consentimento; a instituição precisa definir a aplicável a cada finalidade. Veja [perguntas frequentes da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes) e [LGPD, arts. 7º a 9º e 14](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html).

A interface separa **aceito os Termos de Uso** de **li e estou ciente do Aviso de Privacidade**. As caixas começam desmarcadas. Não há consentimento para marketing, imagem ou outra finalidade opcional adicionado por suposição. Um eventual consentimento específico precisará de finalidade e retirada próprias; não deve ser condicionado ao acesso sem justificativa.

Sem texto institucional informado, GET /legal/documentos apresenta rascunhos identificados e não coleta aceite obrigatório deles. Em produção, a aplicação recusa iniciar sem configuração revisada. Para configurar, copie examples/documentos-legais.example.json para dados-locais/documentos-legais.json, substitua todos os campos com o conteúdo aprovado, incremente versões e defina LEGAL_CONFIG_PATH. Apenas após revisão institucional marque revisadoPelaInstituicao=true. A identificação real da escola e seu contato permanecem no arquivo ignorado, preservando a confidencialidade do projeto.

Na prévia, LEGAL_DEMO_MODE=true apresenta textos fictícios explicitamente sem efeito contratual. O backend exige duas manifestações no aceite do convite ou na entrada de contas existentes. Rotas acadêmicas também conferem a pendência; não basta desabilitar o botão no frontend. Alteração do texto, versão ou identificação institucional muda o hash e pede nova manifestação. A ciência de versão anterior continua preservada.

Cada registro guarda usuário, tipo, versão, hash, texto/identificação apresentados, data e origem, sem IP ou user-agent adicionais. A tabela de registros é imutável e cada titular acessa apenas seus próprios comprovantes pela API. Isso é evidência técnica, não assinatura digital com certificado nem validação jurídica da redação. A produção ainda exige decisões sobre bases legais, retenção, exercício de direitos, fornecedores/transferências e atendimento a menores. A exclusão de contas e registros acadêmicos não é implementada nesta etapa; o procedimento depende das obrigações e prazos institucionais.

## Endpoints

| Método | Caminho | Ação |
| --- | --- | --- |
| GET | /auth/opcoes | Disponibilidade de recuperação e caixa de demonstração |
| POST | /auth/recuperacao | Pedir instruções |
| POST | /auth/recuperacao/redefinir | Consumir link e trocar senha |
| GET | /legal/documentos | Textos vigentes ou rascunhos |
| GET | /legal/status | Pendência do usuário autenticado |
| POST | /legal/aceites | aceitoTermos=true, cienciaPrivacidade=true, termosHash e privacidadeHash |
| GET | /legal/meus-registros | Comprovantes do próprio usuário |

POST /auth/convites/aceitar aceita documentos com os mesmos campos quando exigidos. Hash ausente ou antigo retorna 428; caixas falsas/campos indevidos retornam 400. Login e logout continuam disponíveis para quem tem documentos pendentes. Os limites de tentativas continuam em memória por processo; múltiplas instâncias exigem limitação compartilhada antes de produção.

## Verificação e próximos passos

128 testes passaram: autenticação existente, pedido sem enumeração, cifra e limpeza, expiração/concorrência, invalidação de sessões, convites individuais/importados, retry/idempotência com fetch simulado, isolamento da captura, gate de documentos, versões, atomicidade de ativação, RLS e imutabilidade. Nenhuma mensagem foi enviada pela internet; nenhum dado ou migration desta etapa foi aplicado ao Supabase.

No navegador integrado, pedido de recuperação, captura e abertura do formulário de nova senha foram conferidos; a troca de senha foi validada pelos testes de API. Documentos e suas caixas foram conferidos com textos fictícios. O usuário concluiu o teste manual e aprovou os fluxos. As ações secundárias das telas de acesso foram ajustadas ao padrão visual. A configuração real de Resend/documentos continua pendente.
