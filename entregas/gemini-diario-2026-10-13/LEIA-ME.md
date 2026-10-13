# Pacote atualizado — 13/10/2026

Publicado no Supabase Três Jotas (pvhaqcgoipggrocyxbtj). O schema já foi instalado; não executar novamente 01-banco.sql no projeto atual. O pacote de 08/10 é histórico e foi substituído por este.

| Arquivo | Edge Function | Versão publicada |
|---|---|---:|
| edge-1/index.ts | analysis-batch-submit | 26 |
| edge-2/index.ts | analysis-batch-poll | 20 |
| edge-3/index.ts | sync-clint | 31 |
| edge-4/index.ts | processar-midia-pendente | 8 |
| edge-5/index.ts | analisar-conversa-unica | 10 |

Arquivos autocontidos, sem helpers compartilhados/exportados. Auth interna por CRON_SECRET, mantendo verify_jwt=false conforme publicação anterior e comandos existentes.

A migração original monolítica está arquivada em docs/planos/gemini-schema-completo.sql. Quatro migrations no repositório espelham as versões efetivamente aplicadas no Supabase. A baseline antiga era SQL manual; não usar db push antes de reconciliar essa baseline.

Análise e revisão continuam em gemini-3.6-flash, com Batch na rotina automática. Mídia agora usa GEMINI_MEDIA_MODEL, padrão gemini-3.6-flash: o antigo gemini-2.5-flash devolveu 404 nesse projeto. Transcrição e descrição reais já foram validadas com sucesso. A comparação de qualidade/custo Flash-Lite ainda não foi executada.

Rotina normal: submit a cada dez minutos entre 00:00 e 03:50 de Fortaleza; poll e sync a cada dez minutos; mídia a cada cinco minutos. Timeout HTTP da mídia: 120 segundos.

Recuperação explícita no submit: body {"recuperacao":true,"diaInicio":"2026-10-09","diaFim":"2026-10-10"}, autenticado por CRON_SECRET. Máximo sete dias encerrados, reserva atômica e registro da operação. Sem essa opção, chamadas fora da janela noturna são no-op. O processador de mídia aceita o mesmo intervalo para priorização e limite de 1 a 15 itens.

Os jobs temporários de recuperação já estão ativos: análise dos dias 08–12/10 e prioridade de mídia 09–10/10. Eles se removem ao terminar ou, no máximo, em 15/10 às 00:00 Fortaleza. A recuperação é assíncrona e o estado submetida/processando ainda exige conclusão e revisão; não equivale a análise concluída no ranking. Consulte 03-relatorio.sql ou gemini_execucoes.

04-recuperacao.sql é um registro operacional do acionamento autorizado, não parte da rotina diária. Não aplicar repetidamente sem avaliar o estado atual.

Verificação: nove testes Deno, deno check nas cinco funções e teste PostgreSQL das quatro migrations reais, incluindo reserva por período sem modificar textos externos. Nenhum secret está neste pacote. O modelo solicitado e os tokens ficam registrados; ausência de métricas não significa custo zero.
