# Fechamento definitivo da ficha — MVP

Regra provisória para demonstração, ainda sujeita à confirmação da escola técnica de enfermagem: cada professora fecha somente a ficha do vínculo sob sua responsabilidade. As horas dos demais vínculos continuam compondo o total da disciplina. Fechar uma ficha parcial **não declara aprovação acadêmica ou conclusão da disciplina**.

## Uso

Em **Grupos e fichas**, abra **Ver ficha**, confira aluno, disciplina, local, horas e último dia aprovado. A professora responsável confirma seu papel de preceptora e RT com o COREN cadastrado. Aluno e coordenação consultam o mesmo fechamento, conforme seu escopo de acesso.

O fechamento exige pelo menos um registro aprovado com aprovação vigente e nenhum rascunho, enviado ou devolvido. Cancelados são ignorados no total. A data do último dia é calculada a partir dos registros aprovados; o instante da confirmação é armazenado separadamente. O COREN vem do cadastro autenticado, não do corpo da requisição.

O resumo tem uma revisão. Se os registros mudarem antes da confirmação, a API retorna conflito e exige atualizar e conferir o resumo. Fechamentos simultâneos criam somente uma linha. O snapshot guarda identificação acadêmica, nome/COREN da professora, papéis, horas e registros/aprovações do momento. É imutável, inclusive se os cadastros mudarem depois.

Após fechar, o vínculo não aceita novos registros, edição, envio, devolução, cancelamento, aprovação, reabertura ou alterações da chamada. O histórico permanece consultável. Outros vínculos permanecem independentes. Encerrar matrícula, vínculo ou grupo continua sendo uma operação administrativa diferente.

Não existe reabertura de ficha fechada neste MVP. Antes de usar com dados reais, confirmar com a instituição a política de correção, consolidação após transferência e conclusão da disciplina. Esta confirmação autenticada não implementa assinatura com certificado.

## API

- `GET /frequencia/fichas/:id`: resumo, pendências, revisão e fechamento, com autorização por instituição/aluno/grupo.
- `POST /frequencia/fichas/:id/fechar`: `{ "revisao": "SHA-256 do resumo", "confirmar": true }`. Somente professora responsável; retorna 201 com fechamento.
- 400: entrada inválida ou confirmação ausente; 403: perfil sem permissão; 404: ficha fora do escopo; 409: sem COREN, sem horas válidas, pendências, revisão alterada ou já fechada.

A migration acrescenta `ficha_fechamento`, unicidade por ficha, chaves compostas por instituição, RLS, histórico de fechamento imutável e gatilhos que impedem alteração dos registros/aprovações de ficha fechada. A API usa o mesmo bloqueio de aluno/grupo/vínculo das operações existentes e bloqueia a ficha antes de fechar. Papéis privilegiados continuam capazes de alterar a estrutura do banco.

## Implantação e limites

Migration versionada em `20261110000100_sheet_closure`. Esta mudança não aplica migrations ao Supabase. Validar e implantar separadamente, sem reset e após conferir o estado do ambiente.

Avaliação, PDF e comprovantes de faltas não fazem parte desta etapa. Não aplicar a migration experimental de avaliação. Não incluir PDFs institucionais, identificação da escola, dados reais ou `.env` nos commits.

## Verificação

Testes de API com banco PGlite descartável cobrem fechamento parcial, snapshots, histórico, pendências, confirmação, versões, permissões, isolamento, imutabilidade/RLS, bloqueio das escritas e vínculos históricos. Não comprovam aplicação da migration no Supabase.
