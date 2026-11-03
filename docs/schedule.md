# Cronograma e frequência

Coordenação e professora responsável organizam as sessões dos seus grupos. A professora preenche a chamada; alunos consultam somente sua própria frequência.

## Fluxo da chamada

Abra uma sessão na data atual ou passada. Marque **Presente** ou **Falta** diretamente ao lado de cada aluno e use **Salvar chamada** uma vez. Ninguém começa marcado automaticamente; pessoas não selecionadas continuam sem lançamento. O contador resume presentes, faltas e pessoas ainda não marcadas.

Uma falta pode ser justificada na própria linha, com motivo obrigatório. Correções de uma frequência salva também exigem motivo. A API protege versões e salva o lote inteiro em uma transação: se algum lançamento falhar, nenhum dos lançamentos desse envio é aplicado. Em caso de conflito, atualize a chamada e confira as escolhas antes de reenviar. O lote aceita até 100 pessoas.

Fechar pelo X, Escape ou fora do diálogo com alterações pendentes abre **Chamada não salva**: **Continuar chamada** preserva as escolhas; **Descartar e sair** abandona as alterações. A mesma proteção vale para trocar para edição da sessão ou atualizar uma chamada em conflito. Recarregar ou fechar a página registra a proteção padrão `beforeunload` do navegador, cuja mensagem e exibição dependem do navegador. Durante o salvamento, a saída do diálogo fica bloqueada. Depois de salvar ou descartar, não há aviso por alterações pendentes.

Não é possível marcar falta quando já existe atividade ativa vinculada à sessão. Resolva primeiro o registro. Datas futuras e sessões canceladas não aceitam chamada.

## Horas e faltas

A falta permanece no histórico e não soma horas, mesmo justificada. O aluno continua nas próximas sessões normais do cronograma; as horas cumpridas dependem da aprovação das atividades. Não existe agendamento especial ligado à falta nem geração automática de dias adicionais nesta versão. A instituição ainda precisa confirmar a regra operacional de conclusão quando o cronograma do grupo termina antes de o aluno completar sua carga.

Após presença confirmada, o aluno usa **Registrar atividades** no detalhe da sessão. Data, vínculo e horários ficam preenchidos e protegidos. O fluxo existente de envio, aprovação e reabertura continua sendo a fonte das horas cumpridas. Agendar ou marcar presença não credita horas automaticamente.

Registros antigos e avulsos permanecem preservados. Se existe sessão ativa no mesmo grupo, dia e horário, o aluno deve usar o fluxo do cronograma para não contornar a chamada.

## Organização e histórico

Use **Nova sessão** para organizar um dia do grupo. Lista paginada, filtros por grupo e datas; sem recorrência automática. Alteração e cancelamento exigem versão atual e motivo. Sessões com frequência ou atividade não podem ser alteradas ou canceladas.

Horários da mesma professora não podem se sobrepor, inclusive entre grupos. Registros do aluno mantêm a proteção existente contra sobreposição. O planejador ainda não verifica todos os conflitos futuros entre alunos compartilhados por professoras diferentes.

Cada alteração gera histórico imutável, acessível à coordenação e professora responsável. Alunos não recebem frequências ou justificativas dos colegas. Não inclua dados médicos no motivo.

## API

Rotas autenticadas com escopo de instituição/grupo e `Cache-Control: no-store`:

| Método | Caminho | Ação |
| --- | --- | --- |
| GET | `/agenda/sessoes` | Listar com pagina, de, ate e estagioId opcionais; até 50 por página |
| POST | `/agenda/sessoes` | Criar com estagioId, data, horaInicio e horaFim |
| GET | `/agenda/sessoes/:id` | Sessão e chamada; aluno recebe somente seus vínculos |
| PUT | `/agenda/sessoes/:id` | Alterar data/horários, com versao e motivo |
| POST | `/agenda/sessoes/:id/cancelar` | Cancelar com versao e motivo |
| PUT | `/agenda/sessoes/:id/chamada` | Salvar lancamentos: lista de vinculoId, versao, situacao e motivo quando necessário |
| PUT | `/agenda/sessoes/:id/frequencia` | Salvar um lançamento com as mesmas validações |
| GET | `/agenda/sessoes/:id/historico` | Histórico paginado para coordenação/professora |

`POST /frequencia/registros` aceita sessaoId opcional; verifica presença, acesso, vínculo, data e horário integral.

O módulo separa rotas, controllers, serviços e repositório. A migration acrescenta agenda_sessao, frequencia_sessao, evento_agenda e a referência opcional nos registros, com RLS, chaves compostas, validações de duração/estado, unicidade de registro ativo por aluno/sessão e histórico imutável. Bloqueios de alunos em ordem estável e versões protegem escritas concorrentes.

## Validação e implantação

Os 115 testes passaram em bancos temporários, incluindo autorização, datas, conflitos, versões, correções, lote atômico, concorrência, falta sem crédito, próxima sessão normal, aprovação e histórico. Nenhuma migration foi aplicada ao Supabase. Após revisão e validação, a API real precisará de `npm run db:deploy` no ambiente configurado; não aceite reset.

A [prévia fictícia](frontend.md) tem sessões em 02/11 e 04/11/2026 e banco descartável. O reinício da prévia limpa os dados de teste.
