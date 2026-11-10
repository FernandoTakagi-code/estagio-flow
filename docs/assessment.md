# Avaliação e acompanhamento — MVP

## Regras provisórias para demonstração

Uma avaliação por ficha/vínculo, publicada pela professora responsável com COREN cadastrado. Os nove critérios são os da ficha de referência: iniciativa; assiduidade/pontualidade; destreza manual; segurança; postura profissional; organização do material; comunicação/humanização; evolução de enfermagem; trabalho em equipe.

Cada nota vai de 0 a 10 e aceita até duas casas decimais. As notas são armazenadas como PostgreSQL NUMERIC(4,2) e Prisma Decimal. A média tem pesos iguais, soma dividida por nove. A aprovação na avaliação compara a soma exata com 63 (equivalente à média >= 7); somente a apresentação arredonda para duas casas, metade para cima. Assim, notas cuja média exata é 6,998… aparecem com 7,00, mas continuam abaixo do mínimo. A tela também mostra o resultado para evitar interpretar apenas a média exibida.

Não há rascunho persistido: preencher campos não salva notas; é preciso confirmar e publicar. Após publicar, aluno, professora responsável e coordenação consultam a avaliação. Correções exigem motivo e a versão atual; criam outra linha imutável e preservam notas, critérios e autoria anteriores. Histórico paginado de 20 versões. Pedidos concorrentes não sobrescrevem notas.

Avaliação, horas e fechamento são estados separados. A avaliação pode ser publicada antes ou depois do fechamento de frequência e pode ser corrigida sem alterar seu snapshot. Não exige carga integral nesta etapa. Atingir a nota mínima não declara conclusão da disciplina, especialmente após transferências entre vínculos.

Essas escolhas permitem demonstrar o fluxo; não substituem a confirmação da metodologia pela escola técnica de enfermagem. Não existe consolidação automática das notas de professoras ou vínculos diferentes.

## Interface e API

Aluno/professora: em Minhas fichas ou Grupos e fichas, abrir Ver ficha. A ficha reúne frequência, fechamento e avaliação. Coordenação: Acompanhamento apresenta os vínculos (inclusive sem ficha), horas daquele vínculo, pendências, fechamento e avaliação. Busca textual atua somente na página indicada, até 50 vínculos; não é busca global. As cargas por disciplina são referência e não devem ser somadas novamente a cada vínculo.

- GET `/frequencia/fichas/:id/avaliacao?pagina=1`: critérios, versão vigente e histórico paginado.
- POST `/frequencia/fichas/:id/avaliacao`: `notas` com nove strings decimais em ordem, `versaoAnterior` (0 para primeira), `confirmar: true` e `motivo` obrigatório nas correções. Retorna 201.
- GET `/frequencia/acompanhamento?pagina=1`: somente coordenação da instituição.

Entradas inválidas retornam 400, perfis sem permissão 403, recursos fora do escopo 404, versão desatualizada ou COREN ausente 409. Rotas usam autenticação, verificação de documentos e no-store existentes. Migration inclui RLS, notas válidas, chaves compostas por instituição e proteção de histórico contra UPDATE/DELETE. Notas não são calculadas automaticamente pela chamada.

## Antes de usar com alunos reais

Confirmar vigência dos critérios, periodicidade, responsáveis, pesos, precisão/arredondamento, consulta pelo aluno, correções e consolidação de transferências. Confirmar se avaliação exige toda a carga e como tratar resultado abaixo do mínimo. Conferir configuração e migrations do Supabase, sem reset, antes de implantação. Não incluir dados reais ou documentos institucionais no Git.
