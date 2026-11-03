# Progresso do currículo

O ajuste mantém o sistema visual aprovado: floresta no topo, branco no conteúdo, tipografia e componentes existentes. A consulta completa usa o topo compacto e linhas abertas. “Ver todas” na lista de disciplinas abre a nova consulta; as telas de fichas e registros permanecem acessíveis pelos controles existentes.

Diferença intencional no texto do anel: “Horas do currículo cumpridas” e “do currículo” deixam explícito que excedentes não compensam outra disciplina. A porcentagem é truncada para não mostrar 100% antes de completar todos os minutos exigidos. Completar as horas não significa aprovação acadêmica.

## Verificação

- Suíte de 105 testes no banco temporário: inclui currículo sem vínculos, isolamento entre instituições, restrição da professora, excedentes, reabertura, busca/paginação e fronteiras da arquitetura.
- TypeScript de backend/frontend e build da interface.
- Navegador integrado com aluno vinculado somente a Fundamentos: total 600h, disciplinas com vínculo 90h, dez disciplinas visíveis e sem presença automática.
- Desktop 1536×1024 e celular 390×844. Conceito aprovado e capturas atuais inspecionados com `view_image` na mesma revisão.

| Comparação | Resultado |
| --- | --- |
| Paleta e fundo | Mesmos tokens e arquivo de floresta, área inferior branca |
| Tipografia | Título do topo compacto e nomes de disciplina preservam a escala existente |
| Espaçamento e estrutura | Margens de conteúdo existentes, tabela aberta com divisórias |
| Controles | Mesmo botão, chevron, navegação e estados de foco |
| Conteúdo e celular | Todas as dez disciplinas; números recebem rótulos na disposição vertical |

Sem divergências materiais pendentes na superfície verificada. Este ajuste não cria cronograma, faltas, avaliações ou fechamento de fichas.
