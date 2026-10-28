# Gestão pela coordenação

Entre com uma conta de coordenação. As telas de aluno e professora permanecem disponíveis conforme o perfil autenticado. Para executar a API e a interface, consulte [frontend](frontend.md).

## Pessoas e convites

Em Pessoas, use Cadastrar pessoa para criar aluno ou professora. COREN é opcional para professora. O cadastro retorna um convite de uso único com validade de 48 horas. Copie o link antes de fechar o diálogo: ele fica somente na memória do navegador e não aparece na lista posteriormente. O link usa o endereço atual da interface; endereços `127.0.0.1` servem somente para teste local.

O estado Convite pendente significa que a pessoa ainda não definiu a senha. Abra a pessoa e use Gerar novo convite quando necessário. A ação revoga o convite anterior. Não é uma recuperação de senha para contas já ativadas. O envio por e-mail permanece manual. Nenhuma senha ou chave do banco é definida pela tela de coordenação.

A lista permite buscar por nome/e-mail e filtrar por perfil. Desativar uma conta impede login, invalida sessões e revoga convites; não exclui matrículas e histórico. Reativar uma conta pendente pode exigir gerar novo convite.

## Turmas, disciplinas e locais

Em Turmas e locais, selecione o cadastro desejado e use Adicionar. As cargas de disciplina são horas inteiras. Códigos são normalizados no servidor. A versão atual cria e consulta cadastros; não oferece exclusão nem alteração estrutural desses dados.

## Matrículas e grupos

1. Crie uma turma em Turmas e locais.
2. Abra um aluno em Pessoas e escolha a turma para matriculá-lo.
3. Em Grupos, use Novo grupo, escolhendo turma, disciplina, local e professora ativa.
4. Abra o grupo e vincule um aluno. A lista mostra alunos ativos da turma que ainda não estão ativos naquele grupo.

O aluno pode estar em grupos de disciplinas diferentes. Vinculá-lo a outro grupo da mesma disciplina encerra o vínculo anterior. Transferir a turma encerra a matrícula anterior e todos os vínculos ativos do aluno; confirme a consequência antes de salvar. O histórico continua visível no detalhe da pessoa e do grupo.

Encerrar vínculo afeta apenas aquele vínculo. Encerrar grupo encerra também seus vínculos ativos. Encerrar matrícula encerra também os vínculos ativos do aluno. Esses encerramentos administrativos não substituem o fechamento definitivo das fichas com RT/COREN.

## Importar alunos

Use Importar alunos em Pessoas. Selecione um CSV UTF-8 de até 64 KB e 100 alunos, com somente `nome` e `email`. O [exemplo fictício](../examples/alunos.csv) pode ser usado na prévia local. Nenhum aluno é criado ao gerar a prévia. Corrija os erros no arquivo e selecione-o novamente antes de gerar outra prévia.

Uma prévia válida pode ser confirmada por até 30 minutos. A confirmação cria todos os alunos e convites em uma transação. Os alunos ainda precisam ser matriculados. Copie cada convite antes de fechar. Uma segunda importação dos mesmos e-mails é bloqueada; não sobrescreve contas existentes.

Se a conexão cair durante a confirmação, confira Pessoas antes de tentar novamente, porque a transação pode já ter terminado. Convites perdidos podem ser reemitidos nas contas pendentes.

## Verificação desta etapa

Os testes usam PostgreSQL temporário em memória. A listagem de usuários expõe somente o booleano `convitePendente`, nunca o hash de senha. `GET /academico/matriculas` lista matrículas ativas somente da instituição e somente para a coordenação, com paginação de 50 itens. As demais operações reutilizam a autorização já existente na API.

No navegador integrado foram verificados cadastro de aluno, matrícula, vínculo ao grupo, importação com confirmação, rejeição de duplicados, criação de turma/grupo e consulta de registros. Foram conferidas as larguras desktop 1536×1024 e mobile 390×844 e 320×740. A revisão visual compara a extensão ao sistema aprovado, detalhada em [design da coordenação](coordination-design.md).
