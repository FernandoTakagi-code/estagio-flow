# Estágio Flow

API para digitalizar o controle de frequência de estágio de uma escola técnica de enfermagem. Esta etapa entrega a base de instituição, usuários e turmas.

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

Use as URLs do painel do seu projeto, com a senha codificada para URL. Preserve a verificação do certificado TLS; o exemplo utiliza `sslmode=verify-full`.

Se ocorrer `SELF_SIGNED_CERT_IN_CHAIN`, baixe o certificado CA em **Database > Settings > SSL Configuration** no painel do Supabase. Salve-o localmente em `certs/supabase-ca.crt` e acrescente `&sslrootcert=certs/supabase-ca.crt` às duas URLs. O certificado deve vir do painel oficial; não desative a validação TLS para contornar o erro.

Em um banco de desenvolvimento vazio, aplique a migration versionada e execute o seed explicitamente:

```powershell
npm run db:deploy
npm run db:seed
npm run dev
```

`GET http://localhost:3000/health` retorna `{"status":"ok"}`. Esse endpoint verifica o processo HTTP; não consulta o banco.

O seed cria uma instituição de demonstração e uma turma fictícia. Pode ser repetido sem duplicá-las. Usuários e senhas serão adicionados na etapa de autenticação; disciplinas serão incluídas quando seu modelo existir. Execute dados de demonstração apenas no banco destinado ao desenvolvimento.

## Verificação e migrations

```powershell
npm run db:validate
npm run typecheck
npm run build
npm start
```

O build gera o client antes de compilar. O código gerado fica em `src/generated/prisma`, fora do Git. Validar o schema, gerar o client e compilar não exige credenciais; aplicar migrations e executar o seed exige as URLs configuradas.

Para futuras mudanças no schema:

```powershell
npm run db:migrate -- --name describe_change --create-only
```

Revise o SQL antes de aplicar. Novas tabelas também precisam de RLS habilitado na migration. `migrate dev` pode exigir um shadow database separado; nunca use o próprio banco da aplicação como shadow database. Não aceite reset de um banco com dados que precisam ser preservados.

## Segurança de instalação

O `.npmrc` bloqueia scripts automáticos de instalação. Os scripts explícitos de `npm run` continuam disponíveis. Não remova esse bloqueio para aprovar todos os pacotes de uma vez. Se uma dependência exigir um script, revise o arquivo e aprove apenas o pacote necessário.

As versões do Prisma CLI, client e adapter estão fixadas em 7.10.1; o lockfile fixa a árvore de dependências. Não atualize para uma versão candidata do Prisma 8. A árvore desta etapa não inclui `workerd`.

## Banco e autorização

As tabelas `instituicao`, `usuario` e `turma` possuem RLS habilitado, sem políticas de acesso pela Data API. Isso bloqueia o acesso dessas tabelas pelos papéis comuns da API automática do Supabase. O usuário proprietário do banco e papéis com `BYPASSRLS` podem contornar RLS: portanto, a API Express ainda precisará validar autenticação e autorização em todas as operações de negócio.

O campo `senha_hash` é reservado ao hash de senha, nunca à senha em texto puro. A normalização do e-mail e a validação dos dados de entrada serão implementadas junto com a autenticação.

Consulte [a explicação do banco](docs/database.md) para entender as decisões desta etapa.

## Próximas etapas

- Autenticação e autorização por perfil.
- Disciplinas, campos e registros de estágio.
- Aprovação em lote, histórico de correções e fechamento.
- Painel da coordenação e relatórios.
- Testes automatizados, CI e documentação OpenAPI.
- Avaliação e controle de faltas na fase 2.

## Licença

Projeto proprietário, em desenvolvimento. Não há licença de uso ou redistribuição concedida neste repositório.
