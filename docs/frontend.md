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

Use as contas já criadas pela coordenação. O perfil de coordenação abre a gestão de pessoas, cadastros acadêmicos, grupos e importações. Consulte [o guia da coordenação](coordination.md) para testar o ciclo completo.

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

## Padrão das ações de acesso

Login, convite e recuperação mantêm uma única ação primária verde preenchida. Esqueci minha senha, Recebi um convite e Voltar para o login são ações textuais com o componente Button ghost, sem borda, fundo ou caixa de largura total. Agrupar com espaçamento explícito de 8px e área clicável mínima de 44px. E-mails de demonstração é uma ação auxiliar menor e discreta, separada das ações reais do usuário. Não voltar a usar Button outline nessas ações de navegação; o contorno permanece disponível para outros contextos em que foi aprovado.

## Fluxos disponíveis

- Aluno: acompanhar horas e disciplinas, consultar fichas, criar rascunho, enviar, corrigir devoluções e cancelar rascunhos ou devoluções. Alterações precisam ser salvas antes do envio.
- Em Disciplinas → Ver todas, o aluno consulta a carga do currículo completo, as horas de disciplinas com vínculo e os valores aprovados, enviados, restantes e excedentes por disciplina. Disciplinas ainda sem vínculo aparecem com zero horas cumpridas.
- Professora: filtrar registros e fichas, aprovar de um a cinco registros da mesma ficha, devolver e reabrir com motivo. O histórico e as aprovações anteriores permanecem consultáveis.
- Login: mensagens de erro, mostrar senha, aceitar convite e expiração da sessão. Recuperação disponível quando o e-mail estiver configurado; a prévia usa captura local. Consulte [e-mails e documentos](email-privacy.md).
- Coordenação: cadastrar pessoas e emitir convites, matricular e transferir alunos, organizar turmas, disciplinas, locais e grupos, encerrar vínculos e importar alunos com prévia do CSV.
- Cronograma: coordenação e professora organizam sessões; a professora marca Presente/Falta na lista e salva a chamada de uma vez. O aluno registra as atividades após presença confirmada. Veja [cronograma e frequência](schedule.md).
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

## Currículo e vínculos

Nesta instalação de um único curso, o catálogo de disciplinas da instituição é o currículo. O total é a soma de suas cargas; as dez disciplinas do caderno somam 600h. Criar outra disciplina altera esse total. Não há valor 600 fixado no frontend, nem versionamento de matrizes curriculares nesta etapa. Uma futura oferta de vários cursos ou matrizes exige associar cada turma à sua matriz explicitamente.

O painel retorna `cargaHorariaMinutos` para todo o currículo e `cargaHorariaVinculosMinutos` para as disciplinas em que o aluno tem algum vínculo, inclusive histórico, contando cada disciplina uma vez. O campo `minutosAprovadosCurriculo` limita a contribuição de cada disciplina à carga exigida nela; `minutosRestantesCurriculo` soma as pendências por disciplina. As horas efetivamente aprovadas, incluindo excedentes, continuam preservadas nas consultas de disciplina e nos registros. Reabrir uma aprovação retira sua contribuição atual, sem excluir o histórico.

Na prévia fictícia, `iniciante@example.test` usa a mesma senha de demonstração e possui apenas um vínculo em Fundamentos. Seu painel mostra 600h de currículo e 90h em disciplinas com vínculo. O cronograma possui sessões fictícias para testar presença e falta. A futura avaliação usará nove itens e média mínima 7,00, conforme confirmado; nenhuma avaliação foi implementada neste ajuste.
