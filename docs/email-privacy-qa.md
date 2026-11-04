# Revisão de e-mail e documentos

Testes funcionais pelo navegador integrado com PGlite e contas fictícias, sem envio pela internet. Pedido de recuperação gerou mensagem na caixa local; o link abriu a tela Nova senha em outra aba e o fragmento sumiu da barra. A troca da senha foi verificada por API nos testes automatizados, sem preencher nova credencial pelo navegador.

Na entrada da coordenação, a tela Uso e privacidade apresentou caixas desmarcadas. Foi aberto o texto de demonstração com versão identificada. Marcar apenas termos manteve o avanço bloqueado; marcar ambos liberou a continuação. Os documentos são explicitamente fictícios e sem efeito contratual. Os testes de API também verificam persistência, imutabilidade, versões novas e proteção das rotas acadêmicas.

Desktop nativo 1536×1024; celular em 390×844 e 320×740. Capturas pelo método screenshot do navegador integrado, sem fallback para Playwright externo: privacidade-desktop.png e privacidade-mobile.png na pasta de visualizações da conversa. Conceito aprovado e capturas atuais abertos com view_image na mesma revisão. Referência: `C:/Users/SnyX/.codex/generated_images/01a16182-b7e2-7fd3-8750-b3609e232bb8/exec-098e9293-4758-427d-bbe1-91ec15cb57d4.png`.

| Ponto | Referência e resultado |
| --- | --- |
| Paleta | Verde do sistema e branco puro preservados; marca local usa seu contraste original no cabeçalho branco |
| Tipografia | Família existente, título claro e instruções com entrelinha confortável; labels acessíveis |
| Layout e espaços | Formulário em uma coluna, sem métricas ou cartões decorativos; largura limitada para leitura |
| Controles | Componentes Button/Modal existentes, opções com borda visível, checkboxes de 18px sem pré-seleção |
| Ícones e assets | Marca e arte existentes; nenhum material institucional privado adicionado ao Git |
| Texto | Uso e privacidade, dois documentos e escolhas distintas; rascunho/demonstração explícitos, sem alegação de conformidade |
| Celular | Botões quebram para linhas próprias e labels fluem sem overflow horizontal em 320px |

Diferença intencional do painel aprovado: a etapa de documentos usa cabeçalho e formulário brancos, sem anel de horas ou conteúdo acadêmico antes da manifestação. Login e recuperação preservam a composição existente. O sistema visual foi conferido como fiel nos pontos aplicáveis, sem divergências materiais pendentes na superfície verificada.

128 testes passaram, incluindo os 13 novos testes de fila, recuperação e documentos. A configuração Resend foi testada com fetch simulado; entrega real e textos institucionais dependem de domínio, credenciais e revisão. Nenhuma migration desta etapa foi aplicada ao Supabase. Código pronto para teste manual; sem commit ou merge nesta entrega.

## Correção visual das ações de acesso — 04/11/2026

Após o teste manual aprovado, as ações secundárias do login, convite e recuperação passaram a usar o componente textual existente. Regra registrada em docs/frontend.md.

| Ponto conferido | Resultado |
| --- | --- |
| Hierarquia | Ação principal verde; navegação secundária sem caixa contornada |
| Espaçamento | Ações separadas por 8px; demonstração com distância adicional de 18px |
| Tipografia e paleta | Fonte existente, navegação verde e demonstração em tom discreto |
| Interação | Área de toque mínima de 44px; navegação entre os modos conferida |
| Responsividade | Revisão em desktop, 390px e 320px; largura do documento igual à viewport no teste de 320px |

Conceito aprovado e novas capturas abertos com view_image nesta revisão. Evidências: acesso-acoes-corrigidas.png e acesso-acoes-mobile.png na pasta de visualizações da conversa. TypeScript, build do frontend e git diff --check passaram. Sem alteração na lógica de autenticação.
