import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    // Só em desenvolvimento: deixa abrir o `npm run dev` pelo reencaminhamento de
    // portas do VS Code (https://…devtunnels.ms), para testar no telemóvel com a
    // câmara (que exige https). O build de produção não usa este servidor.
    allowedHosts: [".devtunnels.ms"],
    // Em `npm run dev` o browser vê tudo na mesma origem (:8080). `/api/*` é
    // reencaminhado para a API (uvicorn em :8000), tal como o rewrite de
    // `vercel.json` faz em produção — o cookie httpOnly de sessão passa a
    // funcionar sem CORS.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
      // Só em teste local: a análise do rastreio (janelas-scanner-api, serviço
      // à parte) também passa pela mesma origem. O serviço só aceita CORS de
      // origens conhecidas (produção e localhost), e o telemóvel pelo túnel tem
      // outra origem: por aqui nem há CORS. O alvo por omissão é o mesmo serviço
      // que a produção usa; `SCANNER_ALVO` aponta para outro (ex.: um local em
      // http://localhost:8001). Em produção o frontend fala com ele directamente
      // (VITE_API_SCANNER_URL no Vercel).
      "/scanner": {
        target: process.env.SCANNER_ALVO || "https://janelas-scanner-api.onrender.com",
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/scanner/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (pedido) => pedido.removeHeader("origin"));
        },
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
