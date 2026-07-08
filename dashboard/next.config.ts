import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Reaproveita os dados já buscados ao navegar entre as abas (soft
    // navigation) em vez de buscar de novo no Supabase a cada clique — um
    // reload de página (F5) sempre limpa esse cache do navegador e busca
    // dados novos, então a "atualização" continua funcionando normalmente.
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },
};

export default nextConfig;
