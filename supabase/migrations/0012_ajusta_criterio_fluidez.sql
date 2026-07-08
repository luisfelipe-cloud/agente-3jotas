-- Ajusta a interpretação do critério "fluidez": a descrição antiga fazia a
-- IA zerar o corretor mesmo quando quem parou de responder foi a LEAD (ex:
-- corretor mandou 2 saudações em dias diferentes e a lead nunca respondeu
-- nada — isso não é uma falha de fluidez do corretor). A nova descrição
-- deixa explícito que só conta contra o corretor o tempo que ELE demorou
-- pra responder a lead, não o contrário.
update parametros_analise
set descricao = 'Avaliar se o corretor manteve a troca de mensagens sem deixar a LEAD esperando resposta por muito tempo. Julgue apenas os intervalos em que a lead enviou uma mensagem e ficou aguardando o corretor responder. NÃO penalize o corretor quando quem parou de responder foi a lead (ex: corretor mandou mensagem e a lead nunca respondeu, ou sumiu da conversa) — isso está fora do controle do corretor e não é falha de fluidez dele. Dê nota máxima quando o corretor respondeu a lead rapidamente sempre que ela escreveu. Dê nota intermediária se houve alguma demora do corretor, mas razoável. Dê nota mínima quando o corretor demorou muito ou nunca respondeu a uma pergunta/mensagem direta que a lead enviou.'
where criterio = 'fluidez';
