import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Ícone da aba do navegador — "3J" em laranja (cor de marca, mesma usada nos
// botões/destaques do dashboard), pra não ficar o triângulo padrão do
// Next.js/Vercel na barra do site.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ff5453",
          borderRadius: 7,
          color: "white",
          fontSize: 17,
          fontWeight: 800,
          fontFamily: "Arial, Helvetica, sans-serif",
          letterSpacing: -0.5,
        }}
      >
        3J
      </div>
    ),
    { ...size },
  );
}
