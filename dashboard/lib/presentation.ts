import { readFileSync } from "fs";
import path from "path";
import { CRITERIOS, CRITERIO_LABEL, type CriterioKey } from "@/lib/types";

interface CriterioResumo {
  score: number;
  evidencia: string;
  justificativa: string;
}

interface ConversaResumo {
  conversaId: string;
  leadNome: string;
  leadTelefone: string | null;
  iniciadaEm: string;
  criterios: Record<CriterioKey, CriterioResumo>;
}

export interface DadosApresentacao {
  corretorId: string;
  corretorNome: string;
  dataInicio: string;
  dataFim: string;
  mediasPorCriterio: Record<CriterioKey, number>;
  conversas: ConversaResumo[];
  insight: string | null;
}

// Mesmo limiar usado no dashboard (Pontos de atenção): abaixo disso o
// critério é tratado como erro, não só "abaixo da média". Escala 0-10
// (nota_maxima configurado hoje pra todos os critérios).
const LIMIAR_ERRO = 5;
const MAX_ERROS_EXIBIDOS = 6;

function corDoScore(score: number): string {
  if (score >= 8) return "#1E8E5A";
  if (score >= 5) return "#C97A0C";
  return "#D9302F";
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function escapeHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function logoBase64(): string {
  try {
    const caminho = path.join(process.cwd(), "public", "tresjotas_logo-removebg-preview.png");
    return `data:image/png;base64,${readFileSync(caminho).toString("base64")}`;
  } catch {
    return "";
  }
}

// Cabeçalho discreto repetido em todo slide de conteúdo — kicker + título +
// régua fina, dá a sensação de "grid" consistente entre os slides (era o que
// faltava pra parecer centralizado/alinhado de verdade).
function cabecalho(kicker: string, titulo: string): string {
  return `
    <div class="cabecalho">
      <p class="kicker">${escapeHtml(kicker)}</p>
      <h2>${escapeHtml(titulo)}</h2>
    </div>`;
}

// Gera um HTML autocontido (CSS + JS inline, logo embutida em base64) — um
// "slide deck" navegável por setas/teclado, fundo branco/minimalista, com
// um "canvas" de largura fixa centralizado em todo slide (mesma largura em
// todos, pra dar sensação de alinhamento consistente entre eles).
export function montarApresentacaoHtml(dados: DadosApresentacao): string {
  const { corretorId, corretorNome, dataInicio, dataFim, mediasPorCriterio, conversas, insight } = dados;
  const logo = logoBase64();

  // Link "abrir conversa" — a apresentação é servida em /api/apresentacoes/{id}
  // (mesma origem do dashboard), então um caminho relativo já resolve certo.
  // A página do corretor lê ?conversa= e abre o chat daquela conversa sozinha.
  const linkConversa = (conversaId: string) => `/corretores/${corretorId}?conversa=${conversaId}`;

  const mediaGeral = CRITERIOS.reduce((soma, c) => soma + mediasPorCriterio[c], 0) / CRITERIOS.length;

  const barrasCriterio = CRITERIOS.map((c) => {
    const valor = mediasPorCriterio[c];
    const pct = Math.min(100, Math.max(0, (valor / 10) * 100));
    return `
      <div class="barra-linha">
        <div class="barra-label">
          <span>${CRITERIO_LABEL[c]}</span>
          <span class="barra-valor" style="color:${corDoScore(valor)}">${valor.toFixed(1)}</span>
        </div>
        <div class="barra-trilho"><div class="barra-fill" style="width:${pct}%;background:${corDoScore(valor)}"></div></div>
      </div>`;
  }).join("");

  const erros = conversas
    .flatMap((c) =>
      CRITERIOS.filter((k) => c.criterios[k].score < LIMIAR_ERRO).map((k) => ({
        conversaId: c.conversaId,
        leadNome: c.leadNome,
        leadTelefone: c.leadTelefone,
        criterio: k,
        evidencia: c.criterios[k].evidencia,
        justificativa: c.criterios[k].justificativa,
      })),
    )
    .slice(0, MAX_ERROS_EXIBIDOS);

  const totalErros = conversas.flatMap((c) => CRITERIOS.filter((k) => c.criterios[k].score < LIMIAR_ERRO)).length;

  const cartoesErro = erros
    .map(
      (e) => `
      <div class="callout callout-erro">
        <div class="callout-topo">
          <span class="callout-tag tag-erro">${CRITERIO_LABEL[e.criterio]}</span>
          <a class="callout-lead" href="${linkConversa(e.conversaId)}" target="_blank" rel="noopener">${escapeHtml(e.leadNome)}${e.leadTelefone ? ` · ${escapeHtml(e.leadTelefone)}` : ""}</a>
        </div>
        ${e.evidencia ? `<p class="callout-evidencia">&ldquo;${escapeHtml(e.evidencia)}&rdquo;</p>` : ""}
        <p class="callout-texto">${escapeHtml(e.justificativa || "Critério não atendido.")}</p>
      </div>`,
    )
    .join("");

  const linhasConversas = conversas
    .map((c) => {
      const media = CRITERIOS.reduce((soma, k) => soma + c.criterios[k].score, 0) / CRITERIOS.length;
      const pontos = CRITERIOS.map(
        (k) =>
          `<span class="ponto" title="${CRITERIO_LABEL[k]}: ${c.criterios[k].score.toFixed(1)}" style="background:${corDoScore(c.criterios[k].score)}"></span>`,
      ).join("");
      const href = linkConversa(c.conversaId);
      return `
        <tr>
          <td><a class="linha-lead" href="${href}" target="_blank" rel="noopener">${escapeHtml(c.leadNome)}${c.leadTelefone ? `<span class="lead-telefone"> · ${escapeHtml(c.leadTelefone)}</span>` : ""}</a></td>
          <td>${new Date(c.iniciadaEm).toLocaleDateString("pt-BR")}</td>
          <td class="pontos-cel">${pontos}</td>
          <td><a class="linha-nota" href="${href}" target="_blank" rel="noopener" style="color:${corDoScore(media)}">${media.toFixed(1)}</a></td>
        </tr>`;
    })
    .join("");

  const slides: string[] = [
    // Capa
    `<section class="slide capa active">
      <div class="canvas canvas-capa">
        ${logo ? `<img src="${logo}" alt="Três Jotas" class="logo" />` : `<p class="logo-fallback">TRÊS JOTAS</p>`}
        <div class="regua-capa"></div>
        <p class="kicker kicker-centro">Relatório de atendimento</p>
        <h1>${escapeHtml(corretorNome)}</h1>
        <p class="periodo-pill">${formatarData(dataInicio)} — ${formatarData(dataFim)}</p>
      </div>
    </section>`,

    // Desempenho geral
    `<section class="slide">
      <div class="canvas">
        ${cabecalho("01 · Visão geral", "Desempenho geral")}
        <div class="painel-desempenho">
          <div class="media-bloco">
            <p class="kicker">Média geral</p>
            <div class="media-geral" style="color:${corDoScore(mediaGeral)}">${mediaGeral.toFixed(1)}<span>/10</span></div>
            <p class="legenda">${conversas.length} conversa${conversas.length === 1 ? "" : "s"} concluída${conversas.length === 1 ? "" : "s"} no período</p>
          </div>
          <div class="barras">${barrasCriterio}</div>
        </div>
      </div>
    </section>`,

    // Pontos de atenção (erros)
    `<section class="slide">
      <div class="canvas">
        ${cabecalho("02 · Oportunidades", "Pontos de atenção")}
        ${
          erros.length
            ? `<p class="legenda">${totalErros} critério${totalErros === 1 ? "" : "s"} não atendido${totalErros === 1 ? "" : "s"} no período${totalErros > erros.length ? ` · mostrando os ${erros.length} mais recentes` : ""}</p>
               <div class="grid-callouts">${cartoesErro}</div>`
            : `<div class="callout callout-ok"><p class="callout-texto">Nenhum critério abaixo do esperado neste período.</p></div>`
        }
      </div>
    </section>`,

    // Como melhorar (insight/CTA)
    `<section class="slide">
      <div class="canvas">
        ${cabecalho("03 · Recomendação", "Como melhorar")}
        ${
          insight
            ? `<div class="callout callout-insight">
                <span class="callout-tag tag-insight">Ação recomendada</span>
                <p class="callout-texto callout-texto-lg">${escapeHtml(insight)}</p>
              </div>`
            : `<p class="legenda">Ainda não há insight suficiente para este corretor.</p>`
        }
      </div>
    </section>`,

    // Conversas
    `<section class="slide">
      <div class="canvas">
        ${cabecalho("04 · Detalhamento", "Conversas analisadas")}
        ${
          conversas.length
            ? `<div class="tabela-scroll">
                <table class="tabela">
                  <colgroup>
                    <col class="col-lead" /><col class="col-data" /><col class="col-criterios" /><col class="col-nota" />
                  </colgroup>
                  <thead><tr><th>Lead</th><th>Data</th><th>Critérios</th><th>Nota</th></tr></thead>
                  <tbody>${linhasConversas}</tbody>
                </table>
              </div>`
            : `<p class="legenda">Nenhuma conversa concluída neste período.</p>`
        }
      </div>
    </section>`,

    // Encerramento
    `<section class="slide capa">
      <div class="canvas canvas-capa">
        ${logo ? `<img src="${logo}" alt="Três Jotas" class="logo" />` : `<p class="logo-fallback">TRÊS JOTAS</p>`}
        <div class="regua-capa"></div>
        <p class="subtitulo-escuro">Obrigado!</p>
      </div>
    </section>`,
  ];

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Relatório · ${escapeHtml(corretorNome)}</title>
<style>
  :root { --navy: #215880; --navy-dark: #123a54; --coral: #ff5453; --error: #D9302F; --ink: #1e293b; --muted: #64748b; --line: #eef0f2; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: white; overflow: hidden; -webkit-font-smoothing: antialiased; }
  .deck { position: relative; width: 100vw; height: 100vh; }
  .slide {
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    padding: 5vh 6vw; background: white; border-top: 3px solid var(--coral);
  }
  .slide.active { display: flex; }

  .canvas { width: 100%; max-width: 760px; text-align: left; }
  .canvas-capa { text-align: center; display: flex; flex-direction: column; align-items: center; }

  .cabecalho { margin-bottom: 36px; }
  .kicker { font-size: 11px; font-weight: 700; color: var(--coral); text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 10px; }
  .kicker-centro { text-align: center; }
  h2 { font-size: 25px; font-weight: 800; color: var(--navy-dark); margin: 0; padding-bottom: 18px; border-bottom: 1px solid var(--line); letter-spacing: -0.3px; }

  .logo { width: 180px; height: auto; margin-bottom: 28px; }
  .logo-fallback { font-size: 30px; font-weight: 800; color: var(--navy-dark); letter-spacing: 2px; margin-bottom: 28px; }
  .regua-capa { width: 40px; height: 3px; background: var(--coral); margin-bottom: 24px; }
  h1 { font-size: 40px; font-weight: 800; margin: 0 0 20px; color: var(--navy-dark); letter-spacing: -0.5px; }
  .periodo-pill { display: inline-block; font-size: 12px; font-weight: 600; color: var(--navy-dark); background: #f4f7f9; border: 1px solid var(--line); padding: 7px 16px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.6px; }
  .subtitulo-escuro { font-size: 19px; font-weight: 600; margin: 0; color: var(--navy-dark); }

  .painel-desempenho { display: flex; gap: 56px; align-items: center; }
  .media-bloco { flex-shrink: 0; }
  .media-geral { font-size: 76px; font-weight: 800; line-height: 1; }
  .media-geral span { font-size: 22px; font-weight: 600; color: #b0bac5; margin-left: 3px; }
  .legenda { color: var(--muted); font-size: 13px; margin: 6px 0 24px; }
  .barras { flex: 1; display: flex; flex-direction: column; gap: 16px; }
  .barra-label { display: flex; justify-content: space-between; font-size: 13px; color: #334155; margin-bottom: 6px; font-weight: 600; }
  .barra-valor { font-weight: 800; }
  .barra-trilho { height: 5px; border-radius: 999px; background: #eef1f4; overflow: hidden; }
  .barra-fill { height: 100%; border-radius: 999px; }

  .tabela-scroll { max-height: 58vh; overflow: auto; border: 1px solid var(--line); border-radius: 10px; }
  .tabela { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }
  .tabela col.col-lead { width: 46%; }
  .tabela col.col-data { width: 16%; }
  .tabela col.col-criterios { width: 22%; }
  .tabela col.col-nota { width: 16%; }
  .tabela th { position: sticky; top: 0; text-align: left; color: var(--muted); text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; padding: 12px; background: white; border-bottom: 1px solid var(--line); font-weight: 700; }
  .tabela td { padding: 12px; border-bottom: 1px solid var(--line); color: var(--ink); text-align: left; overflow: hidden; }
  .tabela td:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tabela tbody tr:last-child td { border-bottom: none; }
  .tabela tbody tr:hover td { background: #f8fafc; }
  .lead-telefone { color: var(--muted); font-weight: 400; }
  .linha-lead, .linha-nota { color: inherit; text-decoration: none; }
  .linha-lead { display: block; overflow: hidden; text-overflow: ellipsis; }
  .linha-lead:hover, .linha-nota:hover { text-decoration: underline; }
  .linha-nota { font-weight: 700; }
  .pontos-cel { display: flex; gap: 4px; }
  .ponto { display: inline-block; width: 7px; height: 7px; border-radius: 999px; }

  .grid-callouts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-height: 56vh; overflow-y: auto; }
  .callout { background: white; border: 1px solid var(--line); border-left: 3px solid var(--error); border-radius: 8px; padding: 14px 16px; text-align: left; box-shadow: 0 1px 2px rgba(18,58,84,0.04); }
  .callout-ok { border-left-color: #1E8E5A; }
  .callout-insight { border-left-color: var(--coral); box-shadow: 0 2px 8px rgba(255,84,83,0.08); }
  .callout-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .callout-tag { display: inline-block; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 999px; }
  .tag-erro { background: #fdeaea; color: var(--error); }
  .tag-insight { background: #fff0ef; color: var(--coral); margin-bottom: 12px; }
  .callout-lead { font-size: 11.5px; font-weight: 600; color: #94a3b8; text-decoration: none; }
  .callout-lead:hover { text-decoration: underline; }
  .callout-evidencia { font-size: 12px; font-style: italic; color: var(--muted); margin: 0 0 6px; }
  .callout-texto { font-size: 13px; color: var(--ink); margin: 0; line-height: 1.55; }
  .callout-texto-lg { font-size: 16px; line-height: 1.7; }

  .nav { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 14px;
    background: var(--navy-dark); padding: 9px 16px; border-radius: 999px; z-index: 10; }
  .nav button { background: var(--coral); color: white; border: none; width: 28px; height: 28px; border-radius: 999px; cursor: pointer; font-size: 14px; line-height: 1; }
  .nav button:disabled { opacity: 0.3; cursor: default; }
  .nav span { color: white; font-size: 11px; font-variant-numeric: tabular-nums; min-width: 36px; text-align: center; }
</style>
</head>
<body>
  <div class="deck">
    ${slides.join("\n")}
  </div>
  <div class="nav">
    <button id="prev" aria-label="Anterior">&#8592;</button>
    <span id="contador"></span>
    <button id="next" aria-label="Próximo">&#8594;</button>
  </div>
  <script>
    const slides = document.querySelectorAll(".slide");
    const contador = document.getElementById("contador");
    let atual = 0;
    function mostrar(i) {
      slides.forEach((s, idx) => s.classList.toggle("active", idx === i));
      contador.textContent = (i + 1) + " / " + slides.length;
      document.getElementById("prev").disabled = i === 0;
      document.getElementById("next").disabled = i === slides.length - 1;
    }
    document.getElementById("prev").onclick = () => { if (atual > 0) mostrar(--atual); };
    document.getElementById("next").onclick = () => { if (atual < slides.length - 1) mostrar(++atual); };
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" && atual < slides.length - 1) mostrar(++atual);
      if (e.key === "ArrowLeft" && atual > 0) mostrar(--atual);
    });
    mostrar(0);
  </script>
</body>
</html>`;
}
