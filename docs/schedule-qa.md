# Revisão do cronograma e chamada

Verificação no navegador integrado, com dados fictícios em PGlite. Nenhum dado do Supabase alterado. A professora marcou Bruno como falta e Ana como presente na mesma tela, salvou ambos juntos, corrigiu a falta para justificada com motivo e consultou o histórico. Os lançamentos persistiram após reabrir a sessão. Não há presença automática nem ação de agendamento especial por falta.

Desktop 1536×1024; celular 390×844 e 320×740. Conteúdo e diálogo sem overflow horizontal nas duas larguras móveis; opções aparecem lado a lado abaixo do nome em telas pequenas. O salvamento permanece acessível no rodapé aderente do formulário.

## Comparação visual

Conceito aprovado: `C:/Users/SnyX/.codex/generated_images/01a16182-b7e2-7fd3-8750-b3609e232bb8/exec-098e9293-4758-427d-bbe1-91ec15cb57d4.png`.

Capturas pelo método screenshot do navegador integrado: `chamada-desktop.png` e `chamada-mobile.png`, na pasta de visualizações da conversa. Conceito e render desktop abertos com view_image na mesma revisão; captura móvel também inspecionada.

| Comparação | Referência, render e decisão |
| --- | --- |
| Paleta | Floresta verde e áreas brancas preservadas; seleção verde e laranja torna presença/falta legíveis |
| Tipografia | Mesma família do sistema; nomes destacados, instruções e datas discretas |
| Espaçamento e estrutura | Linhas abertas e divisórias, sem cartões por aluno; diálogo usa o componente existente |
| Controles | Corrigido contraste: fundo branco e borda visível nas opções; seleção com fundo sólido; salvar em verde |
| Ícones e fundo | Marca e imagem existentes; fechar e navegação mantêm os ícones do sistema |
| Texto | Cronograma, dias de estágio e chamada do grupo, Nova sessão e filtros conferidos; instruções novas limitadas ao fluxo solicitado |
| Responsividade | Linhas empilhadas no celular, botões de 46px, sem rolagem horizontal em 390px e 320px |

Mudanças intencionais em relação ao conceito original do painel: superfície Cronograma e diálogo de chamada, controles Presente/Falta, contagem e Salvar chamada. São extensões solicitadas pelo usuário dentro do sistema visual aprovado. A implementação foi verificada como fiel a esse sistema; nenhuma divergência visual material pendente na superfície inspecionada.

## Verificação técnica

Aviso de chamada não salva verificado no navegador integrado: fechar pelo X e por Escape abre a confirmação; continuar preserva a marcação; descartar retorna à lista e reabrir mostra somente os valores salvos. Captura `aviso-chamada.png` inspecionada com view_image. A proteção padrão beforeunload também foi implementada; o diálogo nativo não foi exercitado nesta revisão.

115 testes passaram, incluindo lote atômico, disputa de versões e envio concorrente em ordem invertida, isolamento de instituição/grupo, faltas sem crédito e próxima sessão regular com atividades aprovadas. TypeScript de frontend/backend e build Vite passaram. Migration validada em banco temporário; implantação real ainda pendente.
