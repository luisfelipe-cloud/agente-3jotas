# Design System — Três Jotas

> Documento de especificação para implementação. Baseado na identidade visual
> extraída do logotipo oficial (ver `Manual_Marca_Tres_Jotas.docx` para o
> racional de marca). Stack alvo: **React / Next.js + Tailwind CSS**.

---

## 1. Visão Geral

Duas cores estruturam todo o sistema: **azul petróleo** (base, institucional,
confiança) e **vermelho coral** (destaque, ação, energia). A tipografia é
geométrica e de peso forte nos títulos, regular no corpo de texto. O sistema
deve funcionar bem em: dashboard interno, WhatsApp/CRM, páginas públicas e
materiais transacionais.

**Regra de ouro:** azul domina a interface (fundos, textos, navegação), coral
pontua (CTAs, badges de status, alertas positivos, ícones de destaque). Nunca
inverter essa proporção.

---

## 2. Design Tokens

### 2.1 Cores

```css
:root {
  /* Marca */
  --color-navy-950: #0C2A3D;
  --color-navy-900: #123A54;
  --color-navy-700: #1A4A6B;
  --color-navy-600: #215880; /* cor de marca oficial */
  --color-navy-500: #2C6E9E;
  --color-navy-400: #4A8AB8;
  --color-navy-100: #DCE9F1;
  --color-navy-50:  #F0F6FA;

  --color-coral-700: #E03A39;
  --color-coral-600: #FF5453; /* cor de marca oficial */
  --color-coral-500: #FF6E6D;
  --color-coral-400: #FF8988;
  --color-coral-100: #FFE1E1;
  --color-coral-50:  #FFF3F3;

  /* Neutros */
  --color-gray-900: #1A1A1A;
  --color-gray-700: #2B2B2B;
  --color-gray-500: #6E6E6E;
  --color-gray-300: #B4B4B4;
  --color-gray-100: #E8E8E8;
  --color-gray-50:  #F7F7F7;
  --color-white:    #FFFFFF;

  /* Semânticas — mapeiam para as cores acima, nunca usar hex direto nos componentes */
  --color-primary:        var(--color-navy-600);
  --color-primary-hover:  var(--color-navy-700);
  --color-primary-active: var(--color-navy-900);

  --color-accent:         var(--color-coral-600);
  --color-accent-hover:   var(--color-coral-700);

  --color-bg:             var(--color-white);
  --color-bg-subtle:      var(--color-gray-50);
  --color-surface:        var(--color-white);
  --color-border:         var(--color-gray-100);

  --color-text-primary:   var(--color-gray-900);
  --color-text-secondary: var(--color-gray-500);
  --color-text-inverse:   var(--color-white);
  --color-text-link:      var(--color-navy-600);

  --color-success: #1E8E5A;
  --color-warning: #C97A0C;
  --color-error:   #D9302F;
  --color-info:    var(--color-navy-500);
}
```

**Regra de acessibilidade (contraste WCAG, já calculado):**

| Combinação | Contraste | Uso permitido |
|---|---|---|
| Azul petróleo (`navy-600`) sobre branco | 7.58:1 | Texto de qualquer tamanho (AAA) |
| Branco sobre azul petróleo | 7.58:1 | Texto de qualquer tamanho (AAA) |
| Coral (`coral-600`) sobre branco | 3.16:1 | **Somente** texto grande (≥18px bold ou ≥24px regular), ícones, bordas — não usar em texto corrido |
| Branco sobre coral (`coral-600`) | 3.16:1 | **Somente** texto grande/bold — em botões, usar `coral-700` como fundo se o texto for pequeno |
| Azul sobre coral | 2.4:1 | Não usar — nunca combinar essas duas cores como texto/fundo |

Consequência prática: botões primários de ação devem usar **azul petróleo** como
fundo (contraste seguro). O coral fica reservado para badges, ícones, bordas de
destaque, hover states e elementos decorativos — não para blocos de texto.

### 2.2 Tipografia

```css
:root {
  --font-family-base: "Montserrat", "Open Sans", system-ui, sans-serif;
  --font-family-heading: "Montserrat", system-ui, sans-serif;

  --font-size-xs:   0.75rem;  /* 12px */
  --font-size-sm:   0.875rem; /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg:   1.125rem; /* 18px */
  --font-size-xl:   1.25rem;  /* 20px */
  --font-size-2xl:  1.5rem;   /* 24px */
  --font-size-3xl:  1.875rem; /* 30px */
  --font-size-4xl:  2.25rem;  /* 36px */

  --font-weight-regular:  400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;
  --font-weight-extrabold:800;

  --line-height-tight:  1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed:1.7;
}
```

Uso: `--font-weight-extrabold` reservado para títulos H1/H2 (ecoa o peso do
lettering do logotipo). Corpo de texto sempre `regular` ou `medium`, nunca
abaixo de `font-size-sm` para texto de leitura contínua.

### 2.3 Espaçamento

Escala base 4px (múltiplos de 4), compatível com o espaçamento padrão do Tailwind:

```
0.5 = 2px   1 = 4px   2 = 8px   3 = 12px   4 = 16px
5 = 20px    6 = 24px  8 = 32px  10 = 40px  12 = 48px
16 = 64px   20 = 80px 24 = 96px
```

Não introduzir valores fora dessa escala.

### 2.4 Raio de borda

```css
:root {
  --radius-sm:  4px;   /* inputs, badges pequenos */
  --radius-md:  8px;   /* botões, cards de conteúdo */
  --radius-lg:  16px;  /* cards de destaque, modais */
  --radius-full: 9999px; /* pills, avatares, badges de status */
}
```

### 2.5 Sombras

```css
:root {
  --shadow-sm: 0 1px 2px rgba(26,26,26,0.06);
  --shadow-md: 0 4px 12px rgba(26,26,26,0.08);
  --shadow-lg: 0 12px 32px rgba(26,26,26,0.12);
  --shadow-focus: 0 0 0 3px rgba(33,88,128,0.35); /* anel de foco, baseado em navy-600 */
}
```

### 2.6 Breakpoints

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```
(iguais aos defaults do Tailwind — não redefinir, apenas confirmar consistência.)

---

## 3. Configuração Tailwind

Estender o tema no `tailwind.config.js` — não substituir os defaults, apenas
adicionar os tokens de marca:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#F0F6FA",
          100: "#DCE9F1",
          400: "#4A8AB8",
          500: "#2C6E9E",
          600: "#215880", // marca
          700: "#1A4A6B",
          900: "#123A54",
          950: "#0C2A3D",
        },
        coral: {
          50: "#FFF3F3",
          100: "#FFE1E1",
          400: "#FF8988",
          500: "#FF6E6D",
          600: "#FF5453", // marca
          700: "#E03A39",
        },
      },
      fontFamily: {
        sans: ["Montserrat", "Open Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        md: "8px",
        lg: "16px",
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(33,88,128,0.35)",
      },
    },
  },
};
```

Import da fonte (Google Fonts, no `layout.tsx` ou `_document.tsx`):

```
Montserrat: pesos 400, 500, 600, 700, 800
Open Sans: pesos 400, 600 (fallback para textos longos, se Montserrat pesar demais em blocos extensos)
```

---

## 4. Componentes Base

### 4.1 Botões

| Variante | Fundo | Texto | Borda | Uso |
|---|---|---|---|---|
| `primary` | `navy-600` (hover `navy-700`, active `navy-900`) | `white` | — | Ação principal da tela (1 por contexto) |
| `accent` | `coral-600` (hover `coral-700`) | `white` | — | CTA de destaque pontual (ex: "Enviar documentos") — usar com moderação |
| `secondary` | `white` | `navy-600` | 1px `navy-600` | Ação secundária |
| `ghost` | transparente | `navy-600` | — | Ação terciária, dentro de listas/tabelas |
| `danger` | `error` | `white` | — | Ações destrutivas |

Estados obrigatórios: `default`, `hover`, `active`, `focus` (anel `--shadow-focus`),
`disabled` (opacidade 40%, `cursor-not-allowed`). Raio padrão: `radius-md`.
Altura mínima: 40px (área de toque acessível).

### 4.2 Inputs / Formulários

- Fundo `white`, borda `gray-100`, texto `gray-900`, placeholder `gray-500`.
- Foco: borda `navy-600` + `--shadow-focus`.
- Erro: borda `error`, mensagem auxiliar em `error`, ícone de alerta.
- Label sempre visível acima do campo (não usar apenas placeholder como label).
- Raio: `radius-sm`.

### 4.3 Cards

- Fundo `surface` (branco), borda `border` (`gray-100`) ou `shadow-sm` — escolher
  um dos dois, não empilhar borda + sombra forte.
- Raio: `radius-md` (conteúdo geral) ou `radius-lg` (cards de destaque/hero).
- Padding interno: `24px` (desktop) / `16px` (mobile).

### 4.4 Badges / Status

Pills (`radius-full`), usados para status de lead/conversa (ex: no dashboard de
análise qualitativa):

| Status | Fundo | Texto |
|---|---|---|
| Sucesso / aprovado | `coral-50` | `coral-700` — **ou** `success`/verde se for status positivo genérico (não sobrecarregar o coral como "sucesso universal") |
| Em andamento | `navy-50` | `navy-600` |
| Atenção | `#FFF4E5` | `warning` |
| Erro / crítico | `#FDEAEA` | `error` |
| Neutro | `gray-50` | `gray-500` |

> Nota de produto: como este design system será usado no dashboard do agente de
> análise qualitativa (ver plano do projeto de análise de atendimentos), reservar
> uma cor de badge fixa para "critério não atendido" (ex: `error`) e outra para
> "critério atendido" (ex: `success`) — não usar coral para isso, para não
> confundir com a cor de marca/CTA.

### 4.5 Navegação (header/sidebar)

- Fundo `navy-600` ou `white` com borda inferior `gray-100` — escolher um padrão
  único por produto (não misturar).
- Item ativo: indicador em `coral-600` (borda inferior de 2px ou fundo `navy-700`
  se o header for escuro).
- Texto: `white` (header escuro) ou `gray-700` (header claro), hover em `coral-600`.

### 4.6 Alertas / Toasts

- Estrutura: ícone + texto + ação opcional, `radius-md`, `shadow-md`.
- Cores de fundo suaves (`*-50`) com texto na variante `-700` da mesma família,
  seguindo a tabela de badges acima.

---

## 5. Iconografia

- Estilo: linha (outline), peso 1.5–2px, cantos levemente arredondados — para
  não competir com o peso forte da tipografia de marca.
- Tamanho padrão: 20px (interfaces densas) ou 24px (ações principais).
- Cor padrão: `gray-500` (neutro) ou `navy-600` (ativo/selecionado). Coral
  reservado para ícones de alerta/destaque pontual, não para ícones de
  navegação padrão.
- Biblioteca sugerida: `lucide-react` (mesma disponível no ambiente de artifacts
  do Claude e compatível com o stack React já usado nos projetos).

---

## 6. Checklist de Implementação (para o Claude Code)

- [ ] Criar `tokens.css` (ou `globals.css`) com as variáveis da seção 2.1–2.5.
- [ ] Estender `tailwind.config.js` conforme seção 3.
- [ ] Importar Montserrat (e Open Sans como fallback) via `next/font/google`.
- [ ] Criar componentes base em `components/ui/`: `Button`, `Input`, `Card`,
      `Badge`, `Toast` — todos consumindo os tokens, nunca hex direto no JSX.
- [ ] Validar contraste de qualquer nova combinação de cor contra a tabela da
      seção 2.1 antes de usar coral em texto.
- [ ] Aplicar o mesmo `Button`/`Badge` no dashboard do agente de análise
      qualitativa (dado que os dois projetos são do mesmo ecossistema).
- [ ] Não redefinir breakpoints — usar os defaults do Tailwind (seção 2.6).

---

## 7. Referências

- Manual de marca original (logotipo, versões, área de proteção): documento
  `Manual_Marca_Tres_Jotas.docx`.
- Cores extraídas por amostragem direta da arte do logotipo — confirmar com
  arquivo vetorial original antes de expandir a paleta (tons intermediários
  foram interpolados por Claude, não extraídos da arte, e servem como ponto
  de partida a validar com o time de design).