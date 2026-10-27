# Estágio Flow

API para digitalizar o controle de frequência de estágio de uma escola técnica de enfermagem. Já inclui a base do banco, autenticação e cadastro de usuários pela coordenação.

## Tecnologias

Node.js 22.12+ ou 24, npm 11.19, TypeScript, Express, Prisma 7.10.1 e PostgreSQL no Supabase. O projeto usa módulos ESM.

## Executar localmente

```powershell
git clone https://github.com/FernandoTakagi-code/estagio-flow.git
cd estagio-flow
npm ci
Copy-Item .env.example .env
```

Preencha o `.env` localmente. Não publique suas credenciais:

- `DATABASE_URL`: conexão da aplicação pelo transaction pooler do Supabase, porta 6543.
- `DIRECT_URL`: conexão usada pelo Prisma Migrate. Use conexão direta na porta 5432 ou o session pooler na porta 5432 quando a rede não oferecer IPv6. Não use o transaction pooler para migrations.
- `PORT`: porta HTTP, com padrão 3000.
- `JWT_SECRET`: pelo menos 32 bytes aleatórios em hexadecimal. Gere localmente com o comando indicado no `.env.example` e substitua o valor de exemplo. Não compartilhe essa chave e não reutilize a senha do banco.

Use as URLs do painel do seu projeto, com a senha codificada para URL. Preserve a verificação do certificado TLS; o exemplo utiliza `sslmode=verify-full`.

Se ocorrer `SELF_SIGNED_CERT_IN_CHAIN`, baixe o certificado CA em **Database > Settings > SSL Configuration** no painel do Supabase. Salve-o localmente em `certs/supabase-ca.crt` e acrescente `&sslrootcert=certs/supabase-ca.crt` às duas URLs. O certificado deve vir do painel oficial; não desative a validação TLS para contornar o erro.

Em um banco de desenvolvimento vazio, aplique a migration versionada e execute o seed explicitamente:

```powershell
npm run db:deploy
npm run db:seed
npm run dev
```

`GET http://localhost:3000/health` retorna `{"status":"ok"}`. Esse endpoint verifica o processo HTTP; não consulta o banco.

O seed cria uma instituição de demonstração, uma turma fictícia e dez disciplinas, totalizando 600 horas. Pode ser repetido sem duplicá-las e não cria contas ou senhas. Execute dados de demonstração apenas no banco destinado ao desenvolvimento.

Para criar a primeira conta da coordenação, execute `npm run admin:create` em um terminal interativo. O comando pede nome, e-mail, ID da instituição e senha com confirmação e digitação oculta. Na instituição fictícia do seed, o ID é `00000000-0000-4000-8000-000000000001`.

Veja [autenticação e cadastro de usuários](docs/authentication.md) para os endpoints, exemplos de teste e limitações desta versão.

## Importar alunos

A coordenação pode enviar um CSV com nome e e-mail, revisar erros e confirmar a criação das contas e convites. Consulte [importação por CSV](docs/student-import.md) e o [exemplo fictício](examples/alunos.csv). A matrícula em turma é feita pelas rotas acadêmicas; o envio automático de e-mail ainda está pendente.

## Cadastros acadêmicos

A coordenação pode cadastrar turmas, disciplinas e locais, matricular alunos e organizar grupos com professora responsável. Transferências preservam o histórico. A professora consulta seus grupos e o aluno consulta somente seus próprios vínculos. Consulte [cadastros e vínculos](docs/academic.md) para as rotas e decisões.

## Frequência de estágio

O aluno registra datas, horários e atividades na ficha do próprio vínculo. A API calcula a duração, impede horários sobrepostos e controla rascunho, envio, devolução com motivo e cancelamento. Cada alteração preserva um histórico. Consulte [registros e teste manual](docs/attendance.md).

A professora aprova de um a cinco registros da mesma ficha por vez e pode reabrir um aprovado com motivo, preservando sua aprovação anterior. A API soma as horas aprovadas por aluno e disciplina, incluindo vínculos históricos. Consulte [aprovação, reabertura e totais](docs/approvals.md). Fechamento definitivo e relatórios continuam pendentes; o próximo bloco planejado é o frontend.

## Verificação e migrations

```powershell
npm run db:validate
npm run typecheck
npm test
npm run build
npm start
```

O build gera o client antes de compilar. O código gerado fica em `src/generated/prisma`, fora do Git. Validar o schema, gerar o client e compilar não exige credenciais; aplicar migrations e executar o seed exige as URLs configuradas.

Os testes usam Vitest, Supertest e um PostgreSQL temporário em memória (PGlite), na porta local 55442. Aplicam as migrations e exercitam as rotas reais com o adapter PostgreSQL. As URLs e a chave JWT são substituídas no processo de teste antes de carregar a aplicação; os testes não usam o Supabase nem apagam dados dele. A porta precisa estar disponível. PGlite não substitui a validação da implantação em PostgreSQL convencional e Supabase.

Para futuras mudanças no schema:

```powershell
npm run db:migrate -- --name describe_change --create-only
```

Revise o SQL antes de aplicar. Novas tabelas também precisam de RLS habilitado na migration. `migrate dev` pode exigir um shadow database separado; nunca use o próprio banco da aplicação como shadow database. Não aceite reset de um banco com dados que precisam ser preservados.

## Segurança de instalação

O `.npmrc` bloqueia scripts automáticos de instalação. Os scripts explícitos de `npm run` continuam disponíveis. Não remova esse bloqueio para aprovar todos os pacotes de uma vez. Se uma dependência exigir um script, revise o arquivo e aprove apenas o pacote necessário.

As versões do Prisma CLI, client e adapter estão fixadas em 7.10.1; o lockfile fixa a árvore de dependências. Não atualize para uma versão candidata do Prisma 8. A árvore desta etapa não inclui `workerd`.

## Banco e autorização

As tabelas de negócio, incluindo `ficha_estagio`, `registro_estagio`, `evento_registro`, `aprovacao_registro` e `reabertura_aprovacao`, possuem RLS habilitado, sem políticas de acesso pela Data API. Isso bloqueia o acesso dessas tabelas pelos papéis comuns da API automática do Supabase. O usuário proprietário do banco e papéis com `BYPASSRLS` podem contornar RLS: portanto, a API Express verifica autenticação e autorização nas rotas. Novas rotas de negócio também precisam dessas verificações.

O campo `senha_hash` é reservado ao hash scrypt, nunca à senha em texto puro. É nulo enquanto a conta aguarda um convite. E-mails são normalizados antes de gravar e há uma restrição SQL contra e-mails não normalizados. Senhas, hashes e tokens de convites não aparecem na listagem de usuários.

Consulte [a explicação do banco](docs/database.md) para entender as decisões desta etapa.

## Próximas etapas

- Integração de envio de convites por e-mail e recuperação de senha.
- Frontend de login, registros e aprovação, seguido das telas da coordenação.
- Fechamento definitivo das fichas com RT/COREN.
- Painel da coordenação e relatórios.
- Ampliação dos testes, CI e documentação OpenAPI.
- Avaliação e controle de faltas na fase 2.

## Licença

Projeto proprietário, em desenvolvimento. Não há licença de uso ou redistribuição concedida neste repositório.
