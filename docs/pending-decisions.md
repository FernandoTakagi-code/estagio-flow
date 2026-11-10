# Perguntas para a instituição

## Documentos de uso, privacidade e e-mail

O usuário ainda não sabe quais termos ou contatos institucionais existem. A integração com Resend foi escolhida, mas não há serviço ou domínio configurado. Antes de publicar:

1. A instituição já tem Termos de Uso e Aviso de Privacidade aprovados que se apliquem ao sistema?
2. Quem é o controlador e qual é o contato para exercício dos direitos sobre dados pessoais?
3. Quais finalidades, bases legais e prazos de retenção se aplicam aos dados e históricos do estágio?
4. Há alunos menores de 18 anos? Como a instituição trata seus dados e a participação dos responsáveis?
5. Quais fornecedores, destinatários e eventuais transferências internacionais precisam ser informados?
6. Existem usos opcionais, como imagem ou divulgação, que exigem uma escolha específica e revogável? Não incluir essas autorizações por suposição.
7. Qual domínio/remetente poderá ser verificado no Resend e qual será a origem HTTPS do frontend?

Nesta etapa existem somente rascunhos para revisão e documentos fictícios na prévia. O aceite dos termos e a ciência do aviso são separados; não há consentimento genérico. Nenhum documento deve ser apresentado como aprovado nem como prova de conformidade com a LGPD sem a revisão institucional.

## Avaliação de estágio — confirmar antes de concluir a implementação

O usuário decidiu aguardar esclarecimento da metodologia. Os nove critérios e a indicação de média mínima 7,0 vieram do formulário fornecido; sua vigência e aplicação ainda precisam ser confirmadas. Rascunho, publicação, reabertura e avaliação por vínculo foram propostas de implementação, não regras confirmadas pela instituição.

Perguntar:

1. A ficha enviada ainda é o modelo vigente? Mantém os nove critérios, notas de 0 a 10 e média mínima 7,0?
2. Quando a avaliação acontece: no fim da disciplina, por período, por grupo ou em outra frequência?
3. Quem atribui e valida as notas: professora/preceptora, coordenação e/ou RT?
4. Se o aluno muda de grupo ou professora, como a avaliação da disciplina é consolidada?
5. As notas têm pesos iguais? Quantas casas decimais são aceitas e o mínimo é comparado antes ou depois do arredondamento?
6. Quando o aluno pode consultar as notas? Como se corrigem notas já registradas?
7. A avaliação depende de completar toda a carga horária? Qual é a regra quando a média fica abaixo do mínimo?

Histórico em 03/11/2026: existia implementação experimental sem commit em feat/avaliacao-aluno, não recuperada. Em 10/11/2026 foi implementada a [avaliação para demonstração do MVP](assessment.md), com regras provisórias documentadas, após autorização para avançar antes da consulta à instituição. As perguntas acima permanecem abertas para o piloto real. A nova migration é independente do experimento antigo e não foi aplicada ao Supabase nesta implementação.

## Faltas e carga horária

Confirmar como o aluno completa horas pendentes se o cronograma do grupo terminar: novos dias, outro grupo ou outro procedimento. Atualmente a falta não gera horas; o aluno segue nas sessões normais previstas. Não há agendamento especial automático de reposição.
