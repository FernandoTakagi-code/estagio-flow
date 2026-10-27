# Fichas e registros de frequência

A API cria uma ficha automaticamente no primeiro registro de um vínculo de estágio. A ficha permanece ligada àquele vínculo, aluno, instituição e grupo, preservando o histórico após transferências. Esta etapa não oferece telas; os exemplos usam requisições HTTP.

## Permissões e fluxo

- Aluno: cria registros somente no próprio vínculo ativo; consulta suas fichas, registros e histórico; edita, envia ou cancela rascunhos e registros devolvidos.
- Professora: consulta as fichas dos grupos sob sua responsabilidade e seus registros enviados, devolvidos ou aprovados; devolve registros enviados com motivo obrigatório e pode aprovar ou reabrir conforme o [fluxo de aprovação](approvals.md). Rascunhos e cancelados ficam fora da consulta da professora.
- Coordenação: consulta fichas, registros e histórico da instituição, sem preencher ou devolver registros em nome dos outros perfis.

O fluxo é `rascunho → enviado → devolvido → enviado`. Editar um registro devolvido mantém esse estado até o novo envio. Um registro enviado fica bloqueado para edição e cancelamento. O cancelamento de um rascunho ou devolvido é definitivo: preserva o conteúdo e o histórico, mas libera o horário para outro registro.

Toda criação, edição, envio, devolução e cancelamento grava um evento com autor, versão e cópia do conteúdo resultante, na mesma transação. Os motivos das devoluções continuam disponíveis depois da correção. Não há rotas para apagar registros ou alterar eventos; um trigger também impede `UPDATE` e `DELETE` no histórico. Essa proteção não impede um administrador privilegiado de alterar a estrutura do banco. Após um envio, a professora responsável pode consultar também as revisões anteriores daquele registro.

## Datas e horas

Envie `data` como `YYYY-MM-DD` e horários como `HH:mm`, sem segundos. São horários locais de São Paulo. O banco guarda a data sem horário e os horários como minutos desde meia-noite. A duração é sempre calculada pelo servidor, em minutos inteiros; o cliente não informa totais.

- A saída deve ser posterior à entrada no mesmo dia. Turnos que cruzam a meia-noite não são aceitos nesta versão.
- A data deve estar entre as datas de início e encerramento do vínculo e não pode estar no futuro. Os limites são dias completos no fuso `America/Sao_Paulo`; os timestamps dos cadastros acadêmicos não são uma agenda de aulas.
- Qualquer registro não cancelado reserva o intervalo, inclusive um rascunho ou devolvido. O mesmo aluno não pode sobrepor horários em fichas ou disciplinas diferentes. Intervalos contíguos, como `08:00–12:00` e `12:00–13:00`, são permitidos.
- Encerrar um vínculo ou grupo impede novos registros. Registros já existentes continuam podendo ser corrigidos, enviados e devolvidos dentro do período original. O fechamento definitivo da ficha será implementado em outra etapa.

O bloqueio contra sobreposição é realizado pela API dentro de uma transação com bloqueio do aluno, compartilhando a ordem de bloqueios das transferências. Assim, duas requisições simultâneas não criam intervalos sobrepostos. Escritas diretas no banco podem contornar essa regra; mantenha as operações de negócio pela API. O banco valida duração, ordem dos horários, atividade preenchida e integridade das referências entre instituições e alunos.

## Rotas

Todas exigem `Authorization: Bearer <accessToken>` e usam o prefixo `/frequencia`.

| Método e rota | Dados / resultado |
| --- | --- |
| `GET /fichas?pagina=1` | Fichas visíveis ao usuário; inclui vínculo, grupo e período |
| `POST /registros` | `vinculoId`, `data`, `horaInicio`, `horaFim`, `atividades`; cria rascunho e ficha se necessário, HTTP 201 |
| `GET /registros?pagina=1&fichaId=UUID&status=enviado` | Filtros opcionais, sempre respeitando as permissões |
| `GET /registros/:id` | Registro e versão atual |
| `PUT /registros/:id` | `versao`, `data`, `horaInicio`, `horaFim`, `atividades`; substitui o conteúdo editável |
| `POST /registros/:id/enviar` | `versao` |
| `POST /registros/:id/devolver` | `versao`, `motivo` de 1 a 1000 caracteres após remover espaços das extremidades |
| `POST /registros/:id/cancelar` | `versao` |
| `GET /registros/:id/historico?pagina=1` | Eventos da versão mais recente para a mais antiga |

As listagens retornam até 50 itens por página. Atividades aceitam de 1 a 4000 caracteres após remover espaços das extremidades. Não inclua dados que identifiquem pacientes nas atividades. Campos desconhecidos nos corpos das operações são rejeitados.

O cliente deve usar a `versao` retornada na última consulta ou alteração. Ela começa em 1 e aumenta em cada operação. Uma versão antiga, uma transição inválida ou um horário conflitante retornam HTTP 409. Atualize a consulta antes de repetir a ação; não sobrescreva automaticamente o trabalho mais recente. Recursos sem acesso retornam 404; ações incompatíveis com o perfil retornam 403.

## Teste manual do fluxo

Prepare uma coordenação, uma professora e um aluno com senhas definidas, uma turma com matrícula ativa e um grupo com o aluno vinculado. Consulte [cadastros acadêmicos](academic.md) e [autenticação](authentication.md). O ID necessário é o `vinculo.id` retornado ao adicionar o aluno ao grupo, também disponível em `GET /academico/estagios/:id/alunos`. Nesta etapa não há envio automático de e-mail.

No PowerShell, use os tokens obtidos pelo login de cada perfil, sem salvá-los no repositório. Não envie credenciais ou tokens em capturas de tela.

```powershell
$baseUrl = 'http://localhost:3000'
# Defina $tokenAluno, $tokenProfessora e $vinculoId com seus valores locais.
$alunoHeaders = @{ Authorization = "Bearer $tokenAluno" }
$professoraHeaders = @{ Authorization = "Bearer $tokenProfessora" }
$dia = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. South America Standard Time').ToString('yyyy-MM-dd')
$dados = @{ vinculoId = $vinculoId; data = $dia; horaInicio = '08:00'; horaFim = '12:00'; atividades = 'Atividades fictícias de aprendizagem.' }
$registro = (Invoke-RestMethod "$baseUrl/frequencia/registros" -Method Post -Headers $alunoHeaders -ContentType 'application/json' -Body ($dados | ConvertTo-Json)).registro
# Esperado: rascunho, versão 1, duração 240 minutos.

$registro = (Invoke-RestMethod "$baseUrl/frequencia/registros/$($registro.id)/enviar" -Method Post -Headers $alunoHeaders -ContentType 'application/json' -Body (@{ versao = $registro.versao } | ConvertTo-Json)).registro
# Esperado: enviado, versão 2. A edição pelo aluno agora deve retornar 409.

$registro = (Invoke-RestMethod "$baseUrl/frequencia/registros/$($registro.id)/devolver" -Method Post -Headers $professoraHeaders -ContentType 'application/json' -Body (@{ versao = $registro.versao; motivo = 'Detalhar as atividades realizadas.' } | ConvertTo-Json)).registro
# Esperado: devolvido, versão 3.

$correcao = @{ versao = $registro.versao; data = $dia; horaInicio = '08:00'; horaFim = '12:00'; atividades = 'Descrição fictícia detalhada e corrigida.' }
$registro = (Invoke-RestMethod "$baseUrl/frequencia/registros/$($registro.id)" -Method Put -Headers $alunoHeaders -ContentType 'application/json' -Body ($correcao | ConvertTo-Json)).registro
$registro = (Invoke-RestMethod "$baseUrl/frequencia/registros/$($registro.id)/enviar" -Method Post -Headers $alunoHeaders -ContentType 'application/json' -Body (@{ versao = $registro.versao } | ConvertTo-Json)).registro
# Esperado: enviado, versão 5.

Invoke-RestMethod "$baseUrl/frequencia/registros/$($registro.id)/historico" -Headers $alunoHeaders
# Esperado: cinco eventos, preservando o motivo e a descrição original.
```

Verificações adicionais: tente criar outro registro no mesmo horário (409), acessar com outro aluno ou professora de outro grupo (404) e editar usando uma versão antiga (409). Use dados fictícios em um banco destinado ao desenvolvimento. Os testes automatizados cobrem também concorrência, fuso horário, integridade SQL e isolamento entre instituições.

## Ainda pendente

Fechamento definitivo com RT/COREN e relatórios continuam pendentes. Aprovação de um a cinco registros, snapshots, reabertura e totais aprovados estão disponíveis no [fluxo de aprovação](approvals.md). O envio apenas coloca o registro à disposição da professora; as horas contam como cumpridas após aprovação vigente. A ficha não limita a cinco registros: esse limite pertence ao lote de aprovação.
