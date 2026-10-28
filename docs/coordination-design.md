# Extensão visual da coordenação

Esta etapa estende o sistema visual aprovado para login, aluno e professora. Não altera o conceito existente: reutiliza fundo floresta, superfície branca, tipografia Segoe UI/Inter, verde de ação e laranja de atenção, botões e diálogos já usados.

Inventário: cabeçalho com marca, navegação Pessoas / Turmas e locais / Grupos / Registros e Sair; título no topo compacto; ação primária branca e secundária discreta. Abaixo, listas abertas com divisórias, busca e filtros. Sem nova família de cartões, gráficos ou imagens. Ícones Lucide de traço fino, com rótulos ou nomes acessíveis.

Pessoas: cadastro de alunos e professoras, estado da conta e convite, matrícula e histórico do aluno. Turmas e locais: subtelas Turmas, Disciplinas e Locais com cadastro. Grupos: criação com turma/disciplina/local/professora, lista de alunos e encerramentos administrativos. CSV: arquivo UTF-8, prévia por linha e confirmação separada; convites em memória após criação. Registros mantém a consulta existente.

Diálogos reutilizam formulário, botão e mensagens existentes, com indicação de consequências para transferências e encerramentos. Celular usa navegação em duas linhas e listas verticais sem rolagem horizontal. Conteúdos longos quebram linha; ações e estados permanecem visíveis. Nenhuma identidade real será adicionada aos fontes.

## Registro da revisão

O conceito aprovado da primeira etapa e as capturas atuais foram inspecionados por `view_image`, após testes no navegador integrado. Comparação em viewport desktop 1536×1024, igual à dimensão do conceito; páginas completas podem ultrapassar a altura do viewport. Mobile 390×844 e 320×740 sem overflow horizontal. O status pendente inicialmente invadia uma coluna estreita no celular; agora possui uma linha própria.

| Elemento | Referência | Extensão verificada |
| --- | --- | --- |
| Paleta | Floresta escuro, branco puro, verde e laranja | Mesmos tokens e mesmo arquivo de fundo |
| Tipografia | Sans serif, títulos claros, textos secundários discretos | Mesma família e escala do topo compacto, nomes em 18px e linhas em 15px no desktop |
| Espaçamento | Margens largas e linhas abertas | Mesma largura máxima e margens de 72px no desktop, 20px no celular |
| Ações | Botão primário branco, ação secundária discreta, ícones finos | Mesmos componentes Button e Lucide; campos e diálogos reutilizados |
| Conteúdo | Informação organizada por função, sem cartões decorativos | Lista de pessoas, cadastros e grupos com divisórias; buscas e filtros funcionais |
| Responsividade | Coluna única e controles tocáveis | Dados de pessoa, perfil, turma e situação preservados em linhas no celular |

Diferenças intencionais: a coordenação usa o topo compacto já existente, sem anel de horas, com navegação e textos correspondentes à gestão solicitada. “Pessoas”, “Turmas e locais”, “Grupos”, “Registros”, “Cadastrar pessoa”, “Importar alunos”, “Nova turma” e “Novo grupo” são os textos permitidos no topo desta extensão. Não foram adicionadas mensagens promocionais. A identidade real continua somente em configuração local ignorada pelo Git. Sem divergências materiais pendentes na superfície verificada.
