# Autenticação e usuários

## Fluxo

1. Um administrador com acesso ao terminal e ao banco cria a primeira coordenação com `npm run admin:create`. Não existe endpoint público para criar coordenação.
2. A coordenação faz login e envia o Bearer token nas rotas protegidas.
3. A coordenação cadastra um aluno ou professora. A conta pertence à instituição da própria coordenação; o cliente não pode escolher outra instituição.
4. A resposta contém os dados públicos do usuário e um token de convite. O usuário ainda não consegue fazer login.
5. O usuário recebe esse token por um canal privado e o envia ao endpoint de aceite, junto com sua própria senha. O token expira em 48 horas e só pode ser usado uma vez.

Nesta versão a API retorna o token à coordenação com `Cache-Control: no-store`. A entrega por e-mail ainda não está integrada e não existe tela web para abrir um link de convite. O token não deve ser publicado, registrado em logs ou guardado em planilhas. Somente o hash SHA-256 dele é persistido no banco. Reemitir o convite revoga todos os anteriores ainda pendentes daquele usuário.

## Endpoints

| Método | Rota | Acesso | Resultado |
| --- | --- | --- | --- |
| POST | `/auth/login` | Público, com limite de tentativas | JWT com validade de 15 minutos e dados públicos |
| POST | `/auth/convites/aceitar` | Token de convite | Define a senha e consome o convite |
| GET | `/auth/me` | Autenticado | Dados do usuário atual |
| POST | `/auth/logout` | Autenticado | Invalida todas as sessões anteriores desse usuário |
| POST | `/usuarios` | Coordenação | Cria aluno ou professora e um convite |
| GET | `/usuarios?pagina=1` | Coordenação | Lista até 50 usuários da própria instituição |
| POST | `/usuarios/:id/convite` | Coordenação | Reemite convite para conta ativa que ainda não definiu senha |
| PATCH | `/usuarios/:id/ativo` | Coordenação | Ativa ou desativa aluno/professora da própria instituição |

Não existe cadastro público, exclusão de usuários ou criação de coordenação pela API. Coordenação também não pode desativar outras contas de coordenação por essas rotas. Essas contas exigem administração por quem controla o ambiente; uma gestão auditável desse ciclo de acesso deverá ser adicionada antes do uso em produção.

### Login

```json
{
  "email": "coordenacao@example.test",
  "senha": "SUA_SENHA"
}
```

O resultado contém `accessToken`, `tokenType`, `expiresIn` e `usuario`. Use `Authorization: Bearer TOKEN` nas chamadas protegidas.

### Cadastro pela coordenação

```json
{
  "nome": "Aluno Fictício",
  "email": "aluno@example.test",
  "perfil": "aluno"
}
```

Para professora, use `perfil: "professora"` e, opcionalmente, `coren`. Não envie senha, instituição, estado de ativação ou perfil de coordenação. Campos extras são rejeitados. Alunos não aceitam COREN. A resposta contém `usuario` e `convite: { token, expiraEm }`.

### Aceite de convite

Envie `token` e `senha` em JSON para `/auth/convites/aceitar`. A senha aceita de 12 a 128 caracteres, sem remoção automática de espaços ou truncamento. A resposta de sucesso é 204. Depois, o usuário faz login normalmente.

### Desativação

Envie `{ "ativo": false }` para `/usuarios/:id/ativo`. Isso preserva a conta, revoga convites pendentes e invalida os tokens antigos. Reativar com `true` não ressuscita os tokens ou convites antigos. Uma conta pendente reativada precisa de novo convite.

## Testar a primeira conta no PowerShell

Inicie a API com `npm run dev`. Em outro terminal:

```powershell
$credencial = Get-Credential -Message 'Informe o e-mail e a senha da coordenação'
$corpo = @{
  email = $credencial.UserName
  senha = $credencial.GetNetworkCredential().Password
} | ConvertTo-Json
$sessao = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/auth/login' -ContentType 'application/json' -Body $corpo
$cabecalhos = @{ Authorization = "Bearer $($sessao.accessToken)" }
Invoke-RestMethod -Uri 'http://localhost:3000/auth/me' -Headers $cabecalhos
Remove-Variable corpo, credencial
```

O último comando HTTP mostra os dados públicos da conta; a senha não aparece no histórico do terminal e o token não é impresso. Não cole a senha ou o token em chats. `GetNetworkCredential()` produz uma string temporária para a chamada HTTP; isso não substitui proteção do computador e uso de HTTPS fora de localhost.

## Decisões de segurança

- Senhas usam scrypt assíncrono do Node.js: N=32768, r=8, p=3, salt aleatório de 16 bytes e chave derivada de 64 bytes. A comparação usa `timingSafeEqual`. Usar a biblioteca padrão evita instalar um módulo nativo para hashing.
- JWT usa HS256, emissor e audiência fixos, expiração de 15 minutos e chave aleatória de pelo menos 32 bytes. A aplicação recusa iniciar com a chave de exemplo ou ausente. O payload identifica a conta e sua versão de sessão; não contém senha ou dados escolares.
- Cada chamada autenticada consulta o banco para conferir conta ativa, senha definida, perfil vigente e versão de sessão. Por isso a desativação bloqueia tokens já emitidos em chamadas subsequentes. Requisições que já estavam em execução não são canceladas retroativamente.
- Senha errada, conta inexistente, conta desativada e conta pendente retornam a mesma mensagem de login. Há derivação de senha também para conta inexistente ou pendente.
- Login limita tentativas por IP e por e-mail normalizado. Aceite de convite também tem limite por IP. O armazenamento do limite é em memória por processo. Antes de executar várias instâncias, adote armazenamento compartilhado. Configure `trust proxy` apenas para o proxy efetivamente utilizado no deploy; não confie indiscriminadamente em cabeçalhos enviados pelo cliente.
- Validação usa Zod, JSON tem limite de 16 KB e as respostas não expõem detalhes de erros do banco. Helmet configura cabeçalhos HTTP de proteção.
- A tabela de convites usa RLS sem políticas para a Data API. As rotas Express aplicam autenticação, perfil e filtro por instituição, pois a conexão PostgreSQL administrativa pode contornar RLS.
- As rotas recebem tokens pelo cabeçalho Authorization, não por cookies. O armazenamento do token e a proteção contra XSS precisam ser definidos quando o frontend existir.

## Limitações e próximas etapas

- Ainda não há envio automático de e-mail, recuperação de senha, MFA, refresh token ou frontend. Ao expirar o token, faça login novamente. Isso precisa ser resolvido conforme os requisitos antes de produção.
- A [importação de alunos por CSV](student-import.md) usa prévia, validação e confirmação, sempre com perfil de aluno.
- `criadoPorId` e os convites registram quem iniciou o cadastro. Ainda não há uma trilha completa de auditoria de todas as alterações de acesso.
- Os [cadastros acadêmicos](academic.md) restringem as consultas da professora aos seus grupos e as do aluno aos próprios vínculos. As próximas rotas de frequência e aprovação também precisarão aplicar esses filtros.
- O comando administrativo exige terminal interativo e uma instituição existente. Não há senha padrão nem conta de coordenação no seed. O comando não altera a senha de contas existentes.
