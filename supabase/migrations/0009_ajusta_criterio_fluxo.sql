-- Suaviza a interpretação do critério "fluxo": hoje só sincronizamos o texto
-- das mensagens de WhatsApp/Instagram (via Clint), sem registro de ligações.
-- Com a descrição antiga, a IA zerava o critério em ~85% das conversas
-- porque exigia prova explícita de tentativa de ligação, que nunca aparece
-- no texto. A nova descrição deixa claro que o julgamento deve ser pelo tom
-- da mensagem (indícios de follow-up) em vez de exigir prova textual direta.
update parametros_analise
set descricao = 'Avaliar se o corretor seguiu um fluxo de contato adequado antes de enviar a mensagem de texto. Só temos acesso ao texto do WhatsApp/Instagram (sem registro de ligações), então julgue pelo tom da mensagem: dê nota máxima quando ela soa como um follow-up após tentativa de contato (ex: "algum retorno?", "tentei te ligar", "não consegui falar com você", "vi que você não atendeu"). Dê nota intermediária quando a mensagem é neutra e não deixa claro se houve tentativa prévia (ex: uma saudação simples). Dê nota mínima só quando a mensagem claramente pula essa etapa sem nenhum indício de tentativa de contato anterior, quando isso for esperado pelo script da etapa.'
where criterio = 'fluxo';
