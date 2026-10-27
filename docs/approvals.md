# Aprovação de registros e horas cumpridas

A professora responsável aprova de um a cinco registros enviados da mesma ficha por requisição. Um lote com registro inexistente, sem acesso, fora do estado enviado ou com versão antiga não aprova nenhum item. Falhas durante a gravação também desfazem o lote inteiro. A aprovação continua disponível para registros de vínculos encerrados; o fechamento definitivo da ficha será uma operação separada.

## Fluxo e histórico

O fluxo passa a incluir `enviado → aprovado → devolvido`. A passagem de aprovado para devolvido ocorre exclusivamente pela **reabertura**, com motivo obrigatório. Para aprovar novamente, o aluno corrige se necessário e envia o registro outra vez. Um aprovado não pode ser editado, cancelado, reenviado ou devolvido pela operação comum de devolução.

Cada aprovação cria um snapshot com o registro aprovado, sua versão, duração, atividades, ficha, vínculo, aluno, turma, disciplina, hospital e nome/COREN da professora naquele momento. Mudanças posteriores nos cadastros não alteram essa cópia. O COREN pode estar nulo nesta etapa; a assinatura de fechamento com RT/COREN será tratada depois. Esta aprovação registra a validação interna da professora; não implementa assinatura digital com certificado.

Reabrir cria uma linha separada ligada à aprovação anterior, com professora, data e motivo. A aprovação antiga permanece intacta, mas deixa de valer. Aprovar novamente cria outra aprovação para a nova versão. As operações também aparecem em `GET /frequencia/registros/:id/historico` como `aprovado` e `reaberto`. Aprovações, reaberturas e eventos têm proteção SQL contra alteração e exclusão, além de RLS habilitado. As operações de negócio devem passar pela API; administradores privilegiados do banco continuam capazes de modificar sua estrutura.

As permissões continuam por instituição e grupo: somente a professora responsável aprova e reabre; aluno e coordenação consultam. A professora passa a consultar também registros aprovados dos seus grupos. Os registros cancelados e rascunhos continuam fora da sua consulta.

## Rotas

Todas exigem `Authorization: Bearer <accessToken>`.

| Método e rota | Entrada / resultado |
| --- | --- |
| `POST /frequencia/registros/aprovar` | `{ "registros": [{ "id": "UUID", "versao": 2 }] }`, com 1 a 5 IDs distintos da mesma ficha |
| `POST /frequencia/registros/:id/reabrir` | `{ "versao": 3, "motivo": "Ajustar horário informado." }` |
| `GET /frequencia/registros/:id/aprovacoes?pagina=1` | Até 50 aprovações, da mais recente para a mais antiga, com snapshot, reabertura e indicador `vigente` |
| `GET /frequencia/alunos/:id/horas?pagina=1` | Até 50 disciplinas com carga, minutos aprovados e minutos enviados aguardando aprovação |

As respostas de aprovação e reabertura usam HTTP 200 e retornam a nova versão do registro. Cada operação aumenta essa versão. Versões antigas e transições inválidas retornam 409; IDs repetidos, tamanho inválido ou fichas diferentes no lote retornam 400; recursos sem acesso retornam 404. Ações de aprovação ou reabertura por aluno ou coordenação retornam 403. Recursos em rascunho também retornam 404 para a professora.

O corpo da aprovação retorna `aprovacoes`, com pares `{ registro, aprovacao }`. A ordem é por ID do registro; relacione a resposta aos itens pelo ID, não pela posição original do lote. A reabertura retorna `{ registro, reabertura }`. O motivo aceita de 1 a 1000 caracteres após remover espaços das extremidades.

## Totais por aluno e disciplina

Os totais somam vínculos atuais e históricos da mesma disciplina, sem duplicar a carga horária por ficha. Disciplinas com vínculo, mas ainda sem registros, aparecem com zero horas. Todos os valores são **minutos inteiros**, evitando arredondamento de horas decimais.

- `cargaHorariaMinutos`: carga cadastrada da disciplina multiplicada por 60.
- `minutosAprovados`: duração dos registros na versão aprovada vigente, sem reabertura.
- `minutosEnviados`: duração dos registros enviados que aguardam aprovação. Rascunhos, devolvidos e cancelados não entram nesses dois totais.
- `minutosRestantes`: diferença entre carga e minutos aprovados, com mínimo zero.
- `minutosExcedentes`: diferença entre minutos aprovados e carga, com mínimo zero. O total não é truncado na carga exigida e a aprovação não bloqueia excedentes nesta etapa.

Aluno e coordenação recebem `escopo: "aluno_na_instituicao"`, incluindo todos os vínculos do aluno naquela instituição. O aluno só consulta a si mesmo. A professora recebe `escopo: "grupos_da_professora"`, incluindo somente seus grupos; os campos restantes e excedentes ficam `null`, pois ela pode não ter acesso ao histórico completo da disciplina. Ela só consulta alunos com vínculo atual ou histórico em um de seus grupos. Esses totais não revelam rascunhos nem horas de grupos de outras professoras.

Reabertura e retirada das horas aprovadas acontecem na mesma transação. As consultas usam uma visão consistente do banco. O total aprovado exige aprovação da versão corrente, sem reabertura; aprovações antigas nunca somam novamente as mesmas horas.

## Teste manual

Execute primeiro o [roteiro de registros](attendance.md#teste-manual-do-fluxo), que termina com `$registro` enviado. Reutilize as variáveis locais `$baseUrl`, `$alunoHeaders` e `$professoraHeaders`.

```powershell
$lote = @{ registros = @(@{ id = $registro.id; versao = $registro.versao }) }
$resultado = Invoke-RestMethod "$baseUrl/frequencia/registros/aprovar" -Method Post -Headers $professoraHeaders -ContentType 'application/json' -Body ($lote | ConvertTo-Json -Depth 5)
$registro = $resultado.aprovacoes[0].registro
# Esperado: aprovado. O conteúdo da aprovação está em $resultado.aprovacoes[0].aprovacao.snapshot.

Invoke-RestMethod "$baseUrl/frequencia/alunos/$($registro.alunoId)/horas" -Headers $alunoHeaders
# Esperado: minutosAprovados inclui a duração desse registro.

$reabertura = @{ versao = $registro.versao; motivo = 'Ajustar horário informado.' }
$resultado = Invoke-RestMethod "$baseUrl/frequencia/registros/$($registro.id)/reabrir" -Method Post -Headers $professoraHeaders -ContentType 'application/json' -Body ($reabertura | ConvertTo-Json)
$registro = $resultado.registro
# Esperado: devolvido. As horas desse registro saem do total aprovado.

Invoke-RestMethod "$baseUrl/frequencia/registros/$($registro.id)/aprovacoes" -Headers $alunoHeaders
# Esperado: aprovação anterior preservada, vigente=false e motivo da reabertura disponível.
```

Depois, corrija e envie como no roteiro anterior, usando sempre a versão atual; aprove novamente. Confira que o histórico contém duas aprovações e que os minutos contam somente uma vez, com a duração corrigida. Para testar lote, envie de dois a cinco registros da mesma ficha e inclua todos em `registros`. Envie também um lote com uma versão antiga: nenhum item deve ser aprovado.

Os testes automatizados cobrem lote de cinco, falha no meio da transação, concorrência, permissões, isolamento entre instituições, snapshots imutáveis, reabertura, nova aprovação e soma de vínculos históricos. O fechamento definitivo com RT/COREN e os relatórios continuam pendentes. A próxima etapa planejada é o frontend de login, registro e aprovação.
