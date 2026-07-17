-- Substitui os 3 playbooks-placeholder (cadastrados em 2026-07-08, texto de
-- 1 linha só, claramente teste) pelos scripts de ligação reais da equipe
-- comercial ("Playbooks_Ligação_Três_Jotas.pdf", compilado 16/07/2026,
-- versões V3/V4/V1 por etapa). Mantém os placeholders no banco (histórico),
-- mas desativados — o motor de análise (buscarPlaybooksAtivos em
-- analysis-batch-submit) junta TODOS os playbooks com ativo=true na mesma
-- referência pro critério "playbook", então deixar os dois ativos ao mesmo
-- tempo faria a IA julgar contra um script de teste de 1 frase e o script
-- real ao mesmo tempo.

update playbooks set ativo = false
where conteudo in (
  'Olá! Sou {Nome}, Especialista imobiliário da 3 Jotas. Em que posso te ajudar?',
  'Vou enviar sua simulação para análise e retorno em breve com as informações.',
  'Segue as condições da sua análise:'
);

insert into playbooks (etapa, conteudo, ativo) values
(
  'primeiro_contato',
  $$PLAYBOOK 1 — Primeiro Contato e Reativação de Base (V3 — 04/06/2026)

CONTEXTO DE USO: disparado quando um lead se cadastra numa campanha de redes sociais (Instagram/TikTok) sobre o Minha Casa Minha Vida, ou quando um lead antigo da base está sendo reativado.

REGRA DE NEGÓCIO: em reativação de base, NÃO enviar a mensagem de WhatsApp de "não atendeu" — essa mensagem é exclusiva do primeiro contato (lead novo).

VARIÁVEIS: {nome} nome do cliente; {origem_contato} "agora pouco" (1º contato) ou data/hora específica (reativação); {tipo_lead} novo | reativacao.

ESTADO 1 — Ligação não atendida (só 1º contato, nunca reativação): enviar mensagem de WhatsApp alternando entre 3 modelos (round-robin/aleatório) para variar o padrão. Os 3 modelos seguem a mesma estrutura: cumprimento com nome do corretor (Jorge) e da imobiliária → contexto do cadastro na campanha (MCMV) → aviso de que tentou ligar e não conseguiu → argumento de que por ligação o atendimento é mais completo e personalizado → pergunta de fechamento "qual o melhor horário pra eu te ligar? Manhã, tarde ou noite?".

ESTADO 2 — Ligação atendida: abertura calorosa (corretor se apresenta, tom de simpatia) → pergunta se o cliente já sabe como funciona o MCMV → se não sabe, explica que o primeiro passo é o perfil financeiro (renda define o que dá pra financiar) → COLETA DE PERFIL FINANCEIRO (3 perguntas obrigatórias): (1) trabalha de carteira assinada ou autônomo, (2) valor médio da renda, (3) casado/solteiro/divorciado (se casado, também renda e regime do cônjuge) → resposta de validação sempre positiva/energética, reforçando que o corretor vai acompanhar até a conquista do imóvel → PEDIDO DE DOCUMENTAÇÃO: explica que o próximo passo é rodar a análise na Caixa, pede as 3 fotos (RG e CPF, comprovante de endereço, comprovante de renda/contracheque), oferece entrega presencial ou por WhatsApp, e avisa que a resposta sai rápido (até o dia seguinte).

DOCUMENTOS PADRÃO (usados em todos os 3 playbooks): RG e CPF; comprovante de endereço; comprovante de renda (contracheque).

ESTADO 3 — Transição para WhatsApp: mensagem pós-ligação reforçando, NESSA ORDEM, (1) quem falou com o cliente, (2) sobre o quê, (3) qual é o próximo passo simples (mandar as 3 fotos) — isso aumenta a taxa de envio de documentos. AÇÃO OBRIGATÓRIA do corretor logo em seguida: gravar vídeo selfie se apresentando, mostrando a empresa, a logomarca na parede e falando da localização/endereço.

FLUXO DE FOLLOW-UP (D0–D4), quando o cliente para de responder:
- D0: enviar mensagem de texto retomando no próximo turno.
- D1: mensagem retomando a conversa, pedindo as 3 fotos.
- D2: se não respondeu D1, corretor LIGA de novo (prioridade); se atender, desenvolve a conversa; se não atender, envia mensagem reforçando que a análise não gera custo e pedindo as fotos.
- D3: se sem contato em D1 e D2, corretor LIGA de novo (prioridade); se atender, avalia o momento de compra; se não atender, envia mensagem perguntando diretamente se o silêncio é "falta de tempo" ou "falta de interesse".
- D4: se resposta = falta de tempo → agenda melhor dia/horário. Se resposta = falta de interesse → explica o programa de indicação e/ou encerra com motivo de perda correto. Se sem resposta → encerra o atendimento e registra motivo de perda correto no CRM.

CRITÉRIOS DE AVALIAÇÃO PRA ESTE PLAYBOOK: o corretor tentou ligar antes de mandar mensagem (fluxo); só mandou a mensagem de "não atendeu" se for realmente 1º contato (nunca em reativação); coletou as 3 perguntas de perfil financeiro; pediu os 3 documentos corretos; toda mensagem termina com pergunta de próximo passo (CTA); seguiu a cadência D0–D4 sem deixar o lead sem retorno; registrou motivo de perda quando aplicável.$$,
  true
),
(
  'envio_simulacao',
  $$PLAYBOOK 2 — Envio da Simulação e Cobrança de Documentação (V4 — 22/05/2026)

CONTEXTO DE USO: disparado quando a simulação de crédito (Caixa) já foi rodada com o perfil do cliente e o corretor precisa apresentar o resultado por telefone e cobrar a documentação para confirmação oficial.

VARIÁVEIS: {nome} nome do cliente; {entrada} valor de entrada calculado na simulação (R$); {parcela} valor da parcela mensal calculada (R$); {motivacao_cliente} dor/motivação do cliente coletada em contato anterior (usada no follow-up D1).

ESTADO 1 — Ligação atendida, apresentação da simulação: abertura com energia alta, anunciando "resultado incrível" → apresenta os números reais (entrada R$ {entrada}, parcela R$ {parcela}/mês) como pré-aprovados pela Caixa → compara a parcela com aluguel, reforçando que ali o dinheiro constrói patrimônio → bloco de "imagem do sonho" (plantar a visualização emocional de morar no imóvel próprio) → bloco de URGÊNCIA HONESTA: explica que a simulação reflete condições de hoje (taxa, subsídio, faixa de renda podem mudar) e que imóveis do MCMV nessa faixa somem rápido — sem ser alarmista, é transparência real → PEDIDO DE DOCUMENTAÇÃO: explica que o próximo passo é confirmar os valores oficialmente com a Caixa via documentação (sem custo, sem compromisso), promete retorno rápido (até o dia seguinte) → FECHAMENTO: pergunta de escolha, nunca "se vai mandar" e sim "como vai mandar" (WhatsApp ou presencial) — e silêncio, aguardando resposta.

ESTADO 2 — Transição para WhatsApp: enviar logo após a ligação (emoção ainda quente), repetindo os valores reais da simulação (entrada e parcela) e pedindo as fotos dos documentos (RG e CPF, comprovante de endereço, comprovante de renda + demais documentações). AÇÃO OBRIGATÓRIA: gravar vídeo selfie se apresentando, mostrando a empresa, logomarca e localização.

FLUXO DE FOLLOW-UP (D1–D4) — regra especial: se o primeiro contato ocorreu no fim da tarde/noite, D1 conta como o dia seguinte ao início do atendimento:
- D1: se parou de responder, corretor tenta ligar; se atender, usa o script de reforço mencionando a {motivacao_cliente}; se não atender, envia a mensagem de texto equivalente pedindo as fotos ainda hoje.
- D2: mesma lógica — tenta ligar, reforça que a análise não gera custo, pede as fotos ou oferece entrega presencial.
- D3: sem contato em D1/D2 → NÃO LIGAR MAIS, só enviar mensagem de encerramento perguntando diretamente se o silêncio é "falta de tempo" ou "falta de interesse".
- D4: falta de tempo → agenda melhor dia/horário. Falta de interesse → explica indicação e/ou encerra com motivo de perda correto. Sem resposta → encerra e registra motivo de perda correto no CRM.

CRITÉRIOS DE AVALIAÇÃO PRA ESTE PLAYBOOK: apresentou os valores reais da simulação (entrada e parcela) de forma clara; usou a pergunta de fechamento "como" (WhatsApp ou presencial) em vez de "se"; pediu a documentação completa; manteve a cadência D1–D4 correta, incluindo a regra de NÃO ligar mais a partir de D3; personalizou o D1 com a motivação do cliente quando disponível; registrou motivo de perda quando aplicável.$$,
  true
),
(
  'resultado_analise',
  $$PLAYBOOK 3 — Resultado da Análise de Crédito (V1 — 22/05/2026)

CONTEXTO DE USO: usado após o retorno da análise de crédito pela Caixa Econômica Federal. O corretor liga com o resultado em mãos e conduz a conversa conforme 1 de 8 cenários possíveis.

REGRA DE ESCALONAMENTO OBRIGATÓRIA: em QUALQUER resultado que não seja "Aprovado" (cenários 2 a 8), o corretor deve acionar o Coordenador Anjo ANTES de ligar para o cliente, e conduzir toda a tratativa com ele ao lado — é um gate de aprovação humana antes de liberar o script. Cenário 1 (Aprovado) não precisa desse gate.

REGRA UNIVERSAL: em todo contato — aprovado ou não — usar o momento para pedir indicações (bloco padrão de bonificação de R$ 500,00 por indicação que fecha negócio), ao final de TODO cenário.

VARIÁVEIS: {nome} nome do cliente; {resultado} um dos 8 estados abaixo.

CENÁRIO 1 — APROVADO ✅ (sem gate): tom de celebração genuína, anuncia a aprovação, conecta com o sonho da casa própria, fechamento agendando visita presencial ainda essa semana (hoje ou amanhã). Sub-regra de negociação de valores: se entrada/parcela batem com o que o cliente quer, negociar só presencialmente; se a parcela está ok mas gerou entrada, só falar valores ao vivo; se a entrada ficou muito alta, focar em trazer o cliente à mesa e captar indicações para vendas futuras.

CENÁRIO 2 — Aprovado condicionado: Comprometimento de Renda ⚠ (gate obrigatório): explica que a parcela compromete renda acima do limite aceito; oferece 2 saídas — compor renda de cônjuge/familiar (perde subsídio, aumenta parcela/entrada) ou manter só a renda própria e quitar parcelamentos existentes.

CENÁRIO 3 — Condicionado: Dívidas Internas ⚠ (gate obrigatório): pendência com a própria Caixa (financiamento anterior, cartão, conta); orienta o cliente a ir numa agência da Caixa ainda essa semana pra identificar e negociar a regularização; corretor acompanha o processo e resubmete quando resolvido.

CENÁRIO 4 — Condicionado: Dívidas Externas ⚠ (gate obrigatório): restrição com outros credores (Serasa/SPC); corretor manda as dívidas que constam no CPF do cliente, orienta regularização e resubmissão.

CENÁRIO 5 — Condicionado: No Prazo ⚠ (gate obrigatório): ocorre com clientes mais velhos — prazo do financiamento limitado pela idade (quanto mais perto de 50 anos, menor o prazo), o que impacta a parcela; corretor simula com o prazo real disponível e avalia junto com o cliente se ainda faz sentido; se não couber no orçamento, oferece ajudar de outra forma.

CENÁRIO 6 — Condicionado: BACEN ⚠ (gate obrigatório): restrição no Banco Central vinculada ao CPF (pendência com instituições financeiras); corretor sonda se o cliente tem interesse em resolver antes de orientar; se sim, orienta consultar o Registrato (site oficial do Banco Central, gratuito) pra identificar a instituição e depois regularizar com acompanhamento; se não tiver interesse no momento, deixa a porta aberta sem pressão.

CENÁRIO 7 — Reprovado: Por Rating ❌ (gate obrigatório): reprovação por score de crédito — não é definitivo, tem plano de retomada. Corretor explica o que melhora o score (contas em dia, evitar muitas consultas de CPF, histórico de pagamentos pontuais, movimentar conta corrente na Caixa) e propõe recontato semanal por 3 a 6 meses até refazer a aprovação. NOTA DE IMPLEMENTAÇÃO: esse cenário implica cadência de recontato semanal por até ~3–6 meses — deve virar lembrete recorrente no CRM.

CENÁRIO 8 — Reprovado: Comprometimento de Renda ❌ (gate obrigatório): parcela ultrapassa o limite de comprometimento de renda aceito pela Caixa. Corretor pergunta se o cliente tem financiamento/empréstimo em aberto e oferece 3 saídas — compor renda com cônjuge/familiar/amigo, buscar imóvel de valor menor com parcela compatível, ou aguardar melhora de renda e resubmeter depois.

BLOCO PADRÃO DE INDICAÇÃO (usar ao final de TODO cenário, sem exceção): pedir indicação de amigo/familiar/conhecido que também sonha com a casa própria, oferecendo bonificação de R$ 500,00 por indicação que fecha negócio; se o cliente indicar, anotar o contato na hora.

CRITÉRIOS DE AVALIAÇÃO PRA ESTE PLAYBOOK: em qualquer cenário diferente de "Aprovado", o corretor só deveria ter prosseguido com o script depois de escalar pro Coordenador Anjo (evidência disso pode aparecer como menção explícita na conversa, ou pela demora/pausa antes da ligação de retorno — julgar com bom senso quando não houver evidência direta); usou o cenário certo pro resultado real da análise; ofereceu as saídas corretas do cenário (não inventou solução fora do script); pediu indicação ao final, com o valor de R$ 500,00 mencionado; em reprovação por rating, propôs a cadência de recontato de 3-6 meses; registrou motivo de perda quando o cliente não seguiu adiante.$$,
  true
);
