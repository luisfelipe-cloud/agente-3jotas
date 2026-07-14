import { CRITERIOS, CRITERIO_LABEL, type ConversaAnalisada, type CriterioKey, type MensagemChat } from "@/lib/types";

export interface AnotacaoCriterio {
  criterio: CriterioKey;
  label: string;
  tom: "positivo" | "neutro" | "negativo";
  justificativa: string;
}

function tomDoScore(score: number): AnotacaoCriterio["tom"] {
  if (score >= 8) return "positivo";
  if (score >= 5) return "neutro";
  return "negativo";
}

function normaliza(texto: string) {
  return texto.trim().toLowerCase();
}

// A evidência de cada critério é um trecho literal citado pela IA — tenta
// achar em qual mensagem esse trecho apareceu (casamento em qualquer sentido,
// já que a citação às vezes é um resumo curto e às vezes o texto exato).
export function anotarMensagens(
  mensagens: MensagemChat[],
  criterios: ConversaAnalisada["criterios"],
): Map<string, AnotacaoCriterio[]> {
  const porMensagem = new Map<string, AnotacaoCriterio[]>();

  for (const criterio of CRITERIOS) {
    const resultado = criterios[criterio];
    const evidencia = normaliza(resultado?.evidencia ?? "");
    if (!evidencia || evidencia.length < 6) continue;

    const alvo = mensagens.find((m) => {
      const texto = normaliza(m.texto);
      return texto.includes(evidencia) || evidencia.includes(texto);
    });
    if (!alvo) continue;

    const anotacao: AnotacaoCriterio = {
      criterio,
      label: CRITERIO_LABEL[criterio],
      tom: tomDoScore(resultado.score),
      justificativa: resultado.justificativa,
    };

    const lista = porMensagem.get(alvo.id) ?? [];
    lista.push(anotacao);
    porMensagem.set(alvo.id, lista);
  }

  return porMensagem;
}
