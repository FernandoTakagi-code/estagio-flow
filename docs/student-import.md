# Importação de alunos por CSV

## Formato

A coordenação pode cadastrar até 100 alunos de uma vez, conferindo uma prévia antes de confirmar. O CSV possui somente `nome` e `email`; o perfil é fixo como `aluno`. Não inclua senha, COREN, perfil, turma ou instituição. Matrículas e vínculos com turmas serão implementados no módulo correspondente.

Use UTF-8, com ou sem BOM, separador por vírgula ou ponto e vírgula. São aceitos campos entre aspas, linhas vazias e cabeçalhos invertidos. Nomes e e-mails seguem a validação do cadastro individual; e-mails são convertidos para minúsculas e têm espaços das pontas removidos.

O [exemplo](../examples/alunos.csv) contém somente dados fictícios. Arquivos reais devem ficar fora do Git; dentro do projeto, use a pasta ignorada `dados-locais/`.

## Prévia e confirmação

Envie `POST /usuarios/importacoes/previa` com Bearer token da coordenação e o CSV como corpo, com `Content-Type: text/csv; charset=utf-8`. Não é multipart nem JSON. O limite é 64 KB e de 1 a 100 registros, além do cabeçalho.

A resposta contém `podeConfirmar`, `id`, `expiraEm`, `quantidade` e `alunos`. Cada registro tem `linha`, `nome`, `email` e `erros`. Para campos com quebra de linha entre aspas, `linha` indica onde termina o registro no arquivo.

Erros de conteúdo e duplicados retornam 200 com `podeConfirmar: false` e `id: null`. CSV malformado retorna 400; conteúdo diferente de text/csv retorna 415; excesso de bytes retorna 413. E-mails existentes, inclusive de contas desativadas ou de outro perfil, impedem o cadastro. A mensagem não revela identidade ou instituição da conta existente. Nenhum usuário ou convite é criado na prévia.

Sem erros, a API salva os dados normalizados e devolve o ID da prévia, válida por 30 minutos. Essa cópia sobrevive ao reinício da API. Somente a coordenação que a criou pode confirmá-la.

Para confirmar, envie `POST /usuarios/importacoes/:id/confirmar` com JSON `{ "confirmar": true }` e o mesmo usuário autenticado. Campos extras são rejeitados. A API usa somente os dados já validados no servidor.

A confirmação cria todos os alunos e convites em uma transação. Retorna 201 com `importacaoId`, `quantidade` e `alunos`; cada aluno contém seus dados públicos e `convite: { token, expiraEm }`. Os convites usam a mesma geração do cadastro individual, duram 48 horas e são de uso único. Os tokens não são gravados em texto puro no banco.

Se um e-mail passar a existir depois da prévia, retorna 409 e reverte todo o lote. Não importa parcialmente nem sobrescreve contas. Gere outra prévia. Uma prévia expirada retorna 410; uma já confirmada retorna 409. Confirmações simultâneas não duplicam contas.

Se a conexão cair depois de a transação terminar, consulte a lista de usuários e reemita os convites pendentes necessários. Confirmar novamente não devolve os tokens anteriores. As respostas usam `Cache-Control: no-store`. Não publique tokens, registre-os em logs ou exporte-os para planilhas. O envio automático de e-mail ainda não está integrado. A [tela de importação](coordination.md) permite selecionar o arquivo, conferir os erros por linha e confirmar a criação das contas; os links dos convites são apresentados na confirmação para compartilhar individualmente.

## Teste no PowerShell

Inicie a API com `npm run dev`. Em outro terminal, na raiz do projeto, faça login:

```powershell
$credencial = Get-Credential -Message 'E-mail e senha da coordenação'
$corpo = @{ email = $credencial.UserName; senha = $credencial.GetNetworkCredential().Password } | ConvertTo-Json
$sessao = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/auth/login' -ContentType 'application/json' -Body $corpo
$cabecalhos = @{ Authorization = "Bearer $($sessao.accessToken)" }
Remove-Variable corpo, credencial
```

Envie o exemplo e confira a prévia:

```powershell
$previa = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/usuarios/importacoes/previa' -Headers $cabecalhos -ContentType 'text/csv; charset=utf-8' -InFile '.\examples\alunos.csv'
$previa.alunos | Format-Table linha, nome, email, erros
$previa.podeConfirmar
```

Depois de revisar os dados, confirme. Este bloco cria duas contas fictícias e não imprime tokens:

```powershell
if ($previa.podeConfirmar) {
  $confirmacao = @{ confirmar = $true } | ConvertTo-Json
  $importacao = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/usuarios/importacoes/$($previa.id)/confirmar" -Headers $cabecalhos -ContentType 'application/json' -Body $confirmacao
  $importacao.alunos | Select-Object nome, email, perfil
}
```

O login vence em 15 minutos; repita o login se receber 401. Reenviar o exemplo depois da confirmação deve apontar os e-mails como indisponíveis, pois os alunos já existem.

## Proteção e retenção

A tabela `importacao_alunos` possui RLS sem políticas, vínculos com instituição e criador e CHECK limitando a quantidade de 1 a 100. Na confirmação, os nomes e e-mails da prévia são apagados; os metadados de autoria, quantidade e data permanecem.

Ao gerar uma nova prévia válida, a aplicação também apaga os dados de prévias expiradas daquele usuário. Se ele não voltar a importar, os dados podem permanecer até a limpeza administrativa. Execute `npm run imports:cleanup` para remover os dados de todas as prévias expiradas, sem excluir usuários, convites ou metadados. Antes de produção, configure uma execução periódica no ambiente de implantação; esta versão não cria um agendamento automático.

Cada coordenação pode realizar até 20 chamadas de prévia/confirmar a cada 15 minutos por processo. Várias instâncias exigirão armazenamento compartilhado do limite. Os testes usam exclusivamente PostgreSQL temporário em memória e não importam alunos no Supabase.
