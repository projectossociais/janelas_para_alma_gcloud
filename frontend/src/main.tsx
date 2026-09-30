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
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
