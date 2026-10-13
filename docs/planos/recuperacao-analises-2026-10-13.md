# Recuperação das análises em 13/10/2026

Projeto Três Jotas: pvhaqcgoipggrocyxbtj. Acesso MCP autorizado pelo usuário nesta data.

## Diagnóstico confirmado

Os cinco index.ts de 08/10 estavam publicados, mas o SQL não foi aplicado. A última análise e revisão ocorreram às 15:52 de 08/10, imediatamente antes do deploy. Havia mensagens em 09/10 e 10/10 e nenhuma linha de análise nesses dias. Logs registraram 24 erros de conteudo_versao ausente em cada dia. O cron de submit também continuava diurno.

## Reparos realizados

- Crons pausados durante a instalação e reativados após verificar o schema.
- Poll legado temporário coletou 14 análises e 9 revisões pendentes, sem novas inferências, e foi substituído novamente pelo poll atual.
- Migração monolítica falhou duas vezes no transporte MCP sem alterar o banco. O mesmo schema foi instalado em três migrations menores, com RLS e permissões de service_role garantidas em cada etapa.
- A migração original foi arquivada em docs/planos/gemini-schema-completo.sql. Os quatro arquivos atuais em supabase/migrations espelham os nomes e versões efetivamente aplicados. As migrations antigas 0001–0044 eram SQL manual e não constam do histórico remoto; não executar db push sem reconciliar essa baseline.
- Fila reconstruída para mensagens dos dias 09–12/10; também para mensagens de 08/10 recebidas depois do deploy e para 13/10, que só será avaliado quando encerrar.
- Submit normal: */10 3-6 * * * em UTC. Poll e sync continuam a cada dez minutos; mídia a cada cinco minutos. Comando e autenticação preservados.
- Submit ganhou recuperação explícita, autenticada por CRON_SECRET, limitada a sete dias encerrados. A operação fica registrada no snapshot; hash continua representando o conteúdo avaliável.
- Mídia ganhou recuperação de período, que reserva apenas os dias solicitados e preserva os textos fora do intervalo e os envios incertos.
- Teste real revelou Gemini HTTP 404 para gemini-2.5-flash. Mídia passou a GEMINI_MEDIA_MODEL, padrão gemini-3.6-flash, com parâmetros de pensamento por família. Análise/revisão continuam no 3.6 Flash. Áudios e imagens reais foram processados com sucesso no modelo novo.
- Itens que falharam por 404 foram reabertos sem apagar textos ou histórico de tentativas. A fila recebeu nova versão para impedir publicação de avaliações desatualizadas desses itens.
- Timeout HTTP da mídia passou a 120 segundos, preservando headers e segredo.

## Recuperação temporária

Dois jobs a cada dois minutos:

- gemini-recuperacao-analises-20261013: dias 08–12/10; usa Batch, reserva atômica e revisão.
- gemini-recuperacao-midia-20261013: prioriza os dias 09–10/10.

Os jobs se removem quando suas filas terminam ou, no máximo, em 15/10/2026 às 00:00 de Fortaleza. Não avaliar automaticamente 13/10 antes do encerramento. A rotina normal permanece noturna. Falhas/incertezas exigem diagnóstico; remoção do job não é prova de conclusão de todos os resultados.

## Validação

Nove testes Deno e deno check das funções aprovados. O teste PostgreSQL aplica as quatro migrations reais, verifica dias/versões/cache/retentativas/RLS e comprova que a recuperação de mídia não altera itens fora do intervalo. API REST reconheceu o schema. Batches reais foram submetidos e mídia real registrou uso e sucesso.

## Limites de aprovação e acesso

A revisão automática rejeitou uma função temporária adicional e a leitura de respostas HTTP brutas; utilizou-se o poll existente e apenas status/contagens. A recuperação de mídia foi aprovada após remover qualquer alteração de textos por expiração de lease.

Este registro descreve instalação e início de processamento; os lotes Gemini e as transcrições completam de forma assíncrona. Use gemini_consumo_diario e gemini_execucoes para acompanhar tokens, estados e revisão, sem inferir custo zero quando uso não foi informado.

Documentação consultada: https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash e https://ai.google.dev/gemini-api/docs/thinking.
