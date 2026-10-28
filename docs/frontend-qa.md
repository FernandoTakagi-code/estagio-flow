# Revisão da interface

Verificação em 27/10/2026 pelo navegador integrado, com dados fictícios em banco temporário. Supabase não foi usado nos testes. O conceito aprovado e as capturas finais foram inspecionados com `view_image` na mesma revisão.

## Comparação visual

| Ponto | Conceito aprovado | Interface verificada |
| --- | --- | --- |
| Paleta | Verde floresta escuro acima, branco abaixo, verde e laranja nos estados | Preservada; fundo inferior branco puro e estados com texto além da cor |
| Hierarquia | Título grande à esquerda, ação branca e métricas abaixo | Preservada; tipografia das linhas e controles ampliada para legibilidade |
| Progresso | Anel à direita com horas e porcentagem | Preservado, com valores calculados a partir da API |
| Estrutura | Disciplinas à esquerda e registros à direita, sem cartões externos | Preservada, com divisória e linhas abertas |
| Registros | Data, atividade, horário, duração, status e correção | Preservados; motivo da devolução aparece na linha e no detalhe |
| Identidade | Marca clara sobre fundo escuro | Imagem local configurável com contraste corrigido; repositório usa identidade genérica |
| Celular | Adaptação acordada para lista tocável | Coluna única, ações e formulários acessíveis; sem rolagem horizontal a 390px |

Capturas de referência: desktop em viewport 1536×1024, correspondente ao tamanho do conceito, e celular 390×844 com captura da página completa. A barra de rolagem reduz a área útil do desktop. A captura mobile foi refeita sem o foco temporário no link de pular para o conteúdo.

## Texto e diferenças intencionais

Conferidos: “Meu estágio”, data, “Novo registro”, “Ver minha ficha”, “Horas aprovadas”, “Aguardando aprovação”, correções, “Disciplinas”, “Registros recentes” e filtros. Não há novas chamadas promocionais.

O topo ficou um pouco mais baixo, conforme o ajuste aceito para mostrar mais registros. O anel acompanha essa proporção. A carga diz “nos seus vínculos” para refletir a origem do total. Valores e datas são dinâmicos. O rodapé de proposta visual deu lugar ao nome do produto e ao perfil autenticado. “Sair”, paginação e “Ver todas” são controles operacionais. O nome e o logo reais permanecem apenas na configuração ignorada pelo Git.

## Interações

Verificados no navegador: login, criação e envio, filtro, seleção e aprovação de dois registros, reabertura com motivo, aprovação histórica preservada, correção e reenvio. O envio fica desabilitado enquanto a edição não foi salva. Formulários foram conferidos no celular. Estados vazios e mensagens de erro têm texto visível.

Sem divergências materiais pendentes na superfície verificada. A gestão acadêmica da coordenação, recuperação de senha por e-mail, avaliação e fechamento definitivo de fichas continuam fora desta etapa.
