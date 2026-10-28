# Interface web

A interface usa React, Vite, Tailwind e componentes acessíveis de diálogo. As chamadas passam pela API Express; o navegador não recebe a conexão do banco. O token de sessão fica somente na memória: atualizar a página exige novo login.

## Executar com sua conta

Na raiz do projeto, instale as dependências do frontend uma vez:

```powershell
npm --prefix web ci
```

Abra dois terminais na raiz do projeto. No primeiro, execute a API com o `.env` existente:

```powershell
npm run dev
```

No segundo, execute a interface:

```powershell
npm run web:dev
```

Abra http://127.0.0.1:5173. O proxy de desenvolvimento encaminha `/api` para `http://127.0.0.1:3000`. Se houver outra prévia ocupando a porta 5173, encerre-a com Ctrl+C antes. A configuração opcional `API_PROXY_TARGET`, em `web/.env.local`, deve apontar para a API desejada. Reinicie o Vite após mudar essa configuração.

Use as contas já criadas pela coordenação. Uma conta de coordenação vê uma consulta de registros; a gestão acadêmica e importação continuam disponíveis pela API, e suas telas ficam para a próxima etapa.

## Prévia fictícia isolada

Para testar sem Supabase, inicie no primeiro terminal:

```powershell
npx tsx tests/helpers/serve-ui.ts
```

No segundo terminal PowerShell:

```powershell
$env:API_PROXY_TARGET='http://127.0.0.1:3101'
npm run web:dev
```

Essa prévia cria um banco em memória na porta 55443 e uma API na 3101, com quatro registros e dez disciplinas. O estado é perdido ao encerrar o processo. As contas `aluno@example.test`, `prof@example.test` e `coord@example.test` usam a senha exclusivamente fictícia `SenhaFicticiaParaTeste2026!`. Essas credenciais não funcionam no Supabase.

Para voltar à API real, encerre o Vite, execute `Remove-Item Env:API_PROXY_TARGET -ErrorAction SilentlyContinue` nesse terminal e inicie `npm run web:dev` novamente. Confira também o valor em `web/.env.local`.

## Fluxos disponíveis

- Aluno: acompanhar horas e disciplinas, consultar fichas, criar rascunho, enviar, corrigir devoluções e cancelar rascunhos ou devoluções. Alterações precisam ser salvas antes do envio.
- Professora: filtrar registros e fichas, aprovar de um a cinco registros da mesma ficha, devolver e reabrir com motivo. O histórico e as aprovações anteriores permanecem consultáveis.
- Login: mensagens de erro, mostrar senha, aceitar convite e expiração da sessão. A recuperação de senha ainda depende de integração futura.
- Celular: navegação, lista de registros e formulários adaptados, com suporte a teclado e redução de movimento.

As rotas novas de leitura são `GET /academico/meus-vinculos` e `GET /frequencia/painel`. As listagens de fichas e registros incluem os dados necessários para mostrar aluno, disciplina e motivo de devolução. As restrições de instituição, aluno e professora continuam no servidor. Só aprovações da versão atual e sem reabertura contam para as horas aprovadas.

## Identidade e configuração

O nome e a imagem da instituição são configurados localmente por `VITE_INSTITUTION_NAME` e `VITE_INSTITUTION_LOGO`, seguindo `web/.env.example`. Arquivos em `web/public/branding/` são ignorados pelo Git. Como variáveis `VITE_` ficam públicas no bundle, use-as somente para identidade visual, nunca senhas, JWT_SECRET ou URLs de banco.

Na API, `DATABASE_POOL_MAX` aceita de 1 a 20 conexões, com padrão 5. Os testes e a prévia PGlite usam 1, pois esse banco temporário possui um único backend PostgreSQL. Isso não altera o pool do ambiente real.

## Verificar e publicar futuramente

```powershell
npm run web:typecheck
npm run web:build
npm run typecheck
npm test
```

O build da interface é gerado em `web/dist`. O proxy do Vite serve apenas ao desenvolvimento: uma publicação precisa servir esses arquivos e encaminhar `/api` à API no mesmo domínio, com HTTPS. Nenhuma publicação faz parte desta etapa.

Os testes automatizados cobrem autenticação, autorização, registros, aprovação, reabertura e os dados do painel. A revisão no navegador incluiu criar/enviar, aprovar em lote, reabrir, corrigir e reenviar, em desktop e celular, usando dados fictícios.
