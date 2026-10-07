import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Ubuntu auto-alojada (docs/MARCA.md §4): só o alfabeto latino, que cobre os
// acentos portugueses; sem pedidos a servidores externos nem bloqueio da pintura.
import "@fontsource/ubuntu/latin-300.css";
import "@fontsource/ubuntu/latin-400.css";
import "@fontsource/ubuntu/latin-400-italic.css";
import "@fontsource/ubuntu/latin-500.css";
import "@fontsource/ubuntu/latin-700.css";
import "./design/tokens.css";
import "./index.css";

// Enquanto as páginas novas convivem com as antigas (que só têm tema claro),
// o site fica em claro por omissão: senão, quem tem o sistema em modo escuro
// saltaria entre páginas escuras e claras. A montra escolhe o seu próprio
// tema (useTema). Retirar quando todas as páginas tiverem migrado
// (docs/REDESENHO_FRONTEND.md, Fase 5).
document.documentElement.dataset.tema = "claro";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
