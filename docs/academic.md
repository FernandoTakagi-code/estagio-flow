# Cadastros e vínculos de estágio

## Modelo adotado

Uma turma representa a turma escolar. Cada aluno tem no máximo uma matrícula ativa, mas as matrículas encerradas permanecem no histórico. Alunos importados por CSV ainda precisam ser matriculados pela coordenação.

Um estágio representa um grupo com código, turma, disciplina, local e professora responsável. Uma turma pode ter vários grupos, inclusive para a mesma disciplina. Não há limite fixo de dez alunos: esse número descreve a organização atual, não uma regra confirmada da escola.

O aluno pode ter um vínculo ativo por disciplina. Pode participar de grupos de disciplinas diferentes ao mesmo tempo. Trocar para outro grupo da mesma disciplina encerra o vínculo anterior e cria outro. Trocar de setor dentro do mesmo hospital não exige novo local nem outro grupo.

A troca de professora ou de local exige um novo grupo. Não existe edição dos campos estruturais de um grupo pela API: isso preserva a identidade da professora responsável pelo histórico. A substituição temporária de professora será modelada depois.

O encerramento administrativo do grupo **não é o fechamento da ficha de frequência com assinatura RT/COREN**. Ainda não há ficha, registros, aprovações ou cálculo de horas cumpridas nesta etapa. As datas dos vínculos são datas administrativas de cadastro e transferência, não uma agenda de aulas nem uma programação de horários.

## Acesso

- A coordenação cria os cadastros e organiza matrículas e grupos somente na própria instituição.
- A professora consulta somente grupos nos quais ela é a responsável, incluindo os encerrados, e os vínculos atuais e históricos desses grupos. Não consulta o cadastro global de usuários nem os grupos de outra professora.
- O aluno consulta somente grupos dos quais possui algum vínculo, atual ou encerrado. Ao consultar alunos de um desses grupos, recebe somente seus próprios vínculos.
- As respostas dos alunos dos grupos incluem somente ID, nome e estado de ativação, sem e-mail ou hash de senha.

O acesso ao histórico não concede acesso aos novos grupos para os quais o aluno foi transferido. As próximas rotas de registros e aprovações precisarão aplicar a mesma divisão, além das regras específicas de assinatura e validação.

## Endpoints

Todos usam o prefixo `/academico`, Bearer token e respostas com `Cache-Control: no-store`. Listagens aceitam `?pagina=1`, com até 50 itens por página.

| Método | Caminho após `/academico` | Acesso | Corpo ou comportamento |
| --- | --- | --- | --- |
| POST | `/turmas` | Coordenação | `{ "codigo": "ENF-EXEMPLO" }` |
| GET | `/turmas` | Coordenação | Lista da própria instituição |
| POST | `/disciplinas` | Coordenação | `{ "codigo": "DISC-EXEMPLO", "nome": "Disciplina Fictícia", "cargaHorariaTotal": 30 }` |
| GET | `/disciplinas` | Coordenação | Carga horária em horas inteiras, de 1 a 10000 |
| POST | `/campos-estagio` | Coordenação | `{ "nome": "Hospital Fictício" }` |
| GET | `/campos-estagio` | Coordenação | Locais da própria instituição |
| PUT | `/alunos/:id/turma` | Coordenação | `{ "turmaId": "UUID" }`; matricula ou transfere |
| POST | `/alunos/:id/turma/encerrar` | Coordenação | Encerra matrícula e todos os vínculos ativos de estágio do aluno |
| GET | `/alunos/:id/matriculas` | Coordenação | Matrículas atuais e históricas |
| POST | `/estagios` | Coordenação | Cria grupo conforme exemplo abaixo |
| GET | `/estagios` | Autenticado | Coordenação vê a instituição, professora seus grupos, aluno seus grupos |
| GET | `/estagios/:id` | Autenticado | Mesmo filtro da listagem |
| GET | `/estagios/:id/alunos` | Autenticado | Vínculos do grupo; aluno vê só os próprios |
| POST | `/estagios/:id/alunos` | Coordenação | `{ "alunoId": "UUID" }`; vincula ou transfere na mesma disciplina |
| POST | `/estagios/:id/alunos/:alunoId/encerrar` | Coordenação | Encerra somente aquele vínculo |
| POST | `/estagios/:id/encerrar` | Coordenação | Encerra grupo e todos os vínculos ainda ativos nele |

Para criar um grupo:

```json
{
  "codigo": "FUND-ENF01-A",
  "turmaId": "UUID_DA_TURMA",
  "disciplinaId": "UUID_DA_DISCIPLINA",
  "campoEstagioId": "UUID_DO_LOCAL",
  "professoraId": "UUID_DA_PROFESSORA"
}
```

Use IDs retornados pelos cadastros. O aluno deve estar ativo e matriculado na turma do grupo. A professora deve estar ativa e ter perfil de professora. Contas pendentes de convite podem ser organizadas nos grupos antes de definir a senha. IDs de outra instituição, perfil errado ou conta desativada não podem ser usados para criar esses vínculos.

Turmas, disciplinas e códigos de grupo são únicos por instituição. Códigos são normalizados para maiúsculas. O nome do local é único por instituição, por correspondência exata depois de remover espaços nas pontas; variações de maiúsculas ou grafia ainda precisam ser revisadas pela coordenação.

Repetir a matrícula na mesma turma ou o vínculo no mesmo grupo ativo retorna 200 e reutiliza o registro. Uma nova matrícula ou vínculo retorna 201. Transferências fecham o anterior e criam outro, sem exclusão. Grupo encerrado não recebe novos alunos. Não existem endpoints de exclusão ou edição de códigos, cargas e nomes nesta etapa.

## Banco e concorrência

As tabelas `disciplina`, `campo_estagio`, `matricula_turma`, `estagio` e `vinculo_estagio` têm RLS habilitado sem políticas para a Data API.

Chaves estrangeiras compostas conferem instituição, turma, disciplina e aluno entre os registros relacionados. Alguns IDs aparecem junto com esses campos em índices únicos, mesmo já sendo chaves primárias: essa redundância permite que o PostgreSQL valide as combinações e impeça vínculos cruzados mesmo fora das rotas.

Dois índices únicos parciais no SQL protegem os vínculos ativos:

- Um aluno só pode ter uma linha em `matricula_turma` com `encerrado_em IS NULL`.
- Um par de aluno e disciplina só pode ter uma linha em `vinculo_estagio` com `encerrado_em IS NULL`.

As linhas encerradas ficam fora desses índices, permitindo manter e renovar o histórico. Esses índices e os CHECKs de carga positiva e períodos não invertidos são mantidos no SQL da migration, não no schema do Prisma.

As operações usam transações e bloqueio de linha do aluno para serializar matrículas e transferências. Inclusão e encerramento de um grupo também bloqueiam a linha do grupo. As datas das mudanças vêm do relógio do banco após obter os bloqueios. Assim, duas solicitações simultâneas não deixam duas matrículas ativas nem um vínculo ativo em um grupo já encerrado. As consultas de leitura usam os filtros de acesso independentemente de RLS, pois a conexão administrativa pode contorná-lo.

O campo `criadoPorId` identifica quem criou o grupo, matrícula ou vínculo. Ainda não existe uma trilha completa de auditoria de cada encerramento e de mudanças administrativas.

## Seed e teste manual

`npm run db:seed` mantém a instituição e a turma fictícias e adiciona dez disciplinas, totalizando 600 horas. Repetir o seed não duplica ou sobrescreve as disciplinas existentes. Não cria professoras, alunos, matrículas ou grupos. Execute-o apenas no banco de desenvolvimento.

Para testar com a coordenação já criada, inicie `npm run dev` e faça login conforme [autenticação](authentication.md). Com `$cabecalhos` contendo o Bearer token no PowerShell:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/academico/disciplinas' -Headers $cabecalhos
Invoke-RestMethod -Uri 'http://localhost:3000/academico/turmas' -Headers $cabecalhos
Invoke-RestMethod -Uri 'http://localhost:3000/academico/estagios' -Headers $cabecalhos
```

Inicialmente a lista de grupos pode estar vazia. Para testar o fluxo completo, cadastre um aluno e uma professora pelo fluxo de convites, crie um local, matricule o aluno em uma turma, crie um grupo e vincule o aluno. Confira a consulta com cada perfil e uma transferência de grupo. Use apenas dados fictícios nos testes e não publique tokens de convite ou JWT.

Os testes automatizados exercitam esse fluxo, transferências concorrentes, limites de acesso, integridade das chaves estrangeiras, índices parciais, RLS e repetição do seed, exclusivamente em banco temporário local.
