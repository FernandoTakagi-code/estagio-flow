# Demonstração completa com dados fictícios

## Prévia isolada

Executar na raiz, após instalar os dois lockfiles e gerar o client:

```powershell
npm ci --ignore-scripts
npm --prefix web ci --ignore-scripts
npm run db:generate
npx tsx tests/helpers/serve-ui.ts
```

Em outro terminal:

```powershell
$env:API_PROXY_TARGET='http://127.0.0.1:3101'
npm run web:dev
```

O helper cria banco descartável PGlite, aplica as migrations somente nele e inicializa a API local. Não usa o Supabase. Ao reiniciar, os dados dessa prévia são recriados. A API e a porta de banco podem ser alteradas por DEMO_API_PORT e DEMO_DATABASE_PORT se as portas padrão estiverem ocupadas; ajuste o proxy da interface para a mesma API. Se alterar a porta da interface, configure DEMO_APP_URL no helper para que links fictícios de e-mail apontem à mesma prévia.

As contas fictícias usam `SenhaFicticiaParaTeste2026!`:

- `coord@example.test`: coordenação.
- `prof@example.test`: professora com COREN fictício.
- `aluno@example.test`: Ana, com atividades aprovadas, enviada e devolvida.
- `iniciante@example.test`: Bruno, com vínculo e sem registros.
- `concluido@example.test`: Carla, com presença, atividade enviada/aprovada, avaliação publicada e ficha fechada. O fechamento é parcial por vínculo e não representa conclusão da disciplina de 90h.

Documentos e e-mails da prévia são fictícios. Nunca usar essa senha ou habilitar caixa pública de demonstração com dados reais.

## Roteiro de apresentação

1. Coordenação: mostrar pessoas, turmas, grupos, matrículas e convites. Em Acompanhamento, comparar Ana, Bruno e Carla: pendências, horas por vínculo, avaliação e fechamento.
2. Aluno: entrar como Ana, abrir o registro devolvido, corrigir e salvar antes de enviar. Mostrar autoria e histórico. No cronograma, registrar atividades somente após presença confirmada.
3. Professora: revisar os registros enviados e aprovar em lote da mesma ficha. Mostrar devolução com motivo e reabertura de aprovação antes do fechamento.
4. Na ficha de Ana, preencher as nove notas, conferir e publicar. Corrigir uma nota com motivo e mostrar a versão antiga preservada.
5. Coordenação/aluno: consultar o resultado publicado; mostrar que notas e horas são requisitos independentes.
6. Professora: resolver pendências e fechar a ficha. Conferir COREN, último dia e horas. Abrir Carla para comparar uma ficha já fechada; os registros não aceitam reabertura.
7. Mostrar captura fictícia de convite/recuperação e os documentos de demonstração se necessário. Não enviar e-mails reais durante a apresentação.

## Conexão posterior ao Supabase

O merge não aplica migrations. Primeiro confirmar qual projeto é destinado ao desenvolvimento/piloto e se contém dados que precisam ser preservados. Configurar DATABASE_URL e DIRECT_URL em .env ignorado, com TLS, pooler correto e credenciais locais; nunca enviar chaves para commits ou logs.

Verificar `npm run db:status`, revisar migrations pendentes e só então executar `npm run db:deploy` no ambiente confirmado, sem reset. Seed fictício somente no banco de desenvolvimento destinado a demonstração. Criar coordenação com `npm run admin:create` no terminal; demais contas por convite. Não reutilizar usuários/senha do helper na produção. Testar os três perfis e isolamento de instituição antes de apresentar com esse banco.

A conexão real exige acesso/configuração do projeto Supabase; a prévia isolada e os testes não comprovam que esse ambiente esteja configurado. E-mail real/domínio e documentos institucionais revisados continuam como pré-requisitos do piloto com pessoas reais.
