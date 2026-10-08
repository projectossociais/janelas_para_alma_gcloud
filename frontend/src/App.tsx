import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { FeedbackProvider } from "@/contexts/FeedbackContext";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";
import { CarteiraJogoProvider } from "@/contexts/CarteiraJogoContext";
import { ConsentimentoSaudeProvider } from "@/contexts/ConsentimentoSaudeContext";
import Inicio from "./pages/Inicio";
const Sobre = lazy(() => import("./pages/Sobre"));
const Equipa = lazy(() => import("./pages/Equipa"));
const Kamba = lazy(() => import("./pages/Kamba"));
const CampanhaGamek = lazy(() => import("./pages/CampanhaGamek"));
const Publicacoes = lazy(() => import("./pages/Publicacoes"));
const PublicacaoDetalhe = lazy(() => import("./pages/PublicacaoDetalhe"));
const Parceiros = lazy(() => import("./pages/Parceiros"));
const PortalClinicoOptioptika = lazy(() => import("./pages/PortalClinicoOptioptika"));
const Tecnologia = lazy(() => import("./pages/Tecnologia"));
const Circular = lazy(() => import("./pages/Circular"));
const Suporte = lazy(() => import("./pages/Suporte"));
const Exercicios = lazy(() => import("./pages/Exercicios"));
const Scanner = lazy(() => import("./pages/Scanner"));
const ScannerResultados = lazy(() => import("./pages/ScannerResultados"));
const MarcarConsulta = lazy(() => import("./pages/MarcarConsulta"));
import { EstruturaSite } from "./components/site/EstruturaSite";
import { CarregarPagina } from "./components/site/CarregarPagina";
const Auth = lazy(() => import("./pages/Auth"));
const AtualizarPassword = lazy(() => import("./pages/AtualizarPassword"));
const ConfirmarEmail = lazy(() => import("./pages/ConfirmarEmail"));
const Apoiar = lazy(() => import("./pages/Apoiar"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const EditarPerfil = lazy(() => import("./pages/EditarPerfil"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const TermosUtilizacao = lazy(() => import("./pages/TermosUtilizacao"));
const Faq = lazy(() => import("./pages/Faq"));
const Impacto = lazy(() => import("./pages/Impacto"));
const JunteSe = lazy(() => import("./pages/JunteSe"));
const RegistoPremium = lazy(() => import("./pages/RegistoPremium"));
const TesteSeteDias = lazy(() => import("./pages/TesteSeteDias"));
const RoadmapTecnico = lazy(() => import("./pages/RoadmapTecnico"));
const MenuJogo = lazy(() => import("./pages/jogo/MenuJogo"));
const JogoCuriosidades = lazy(() => import("./pages/jogo/JogoCuriosidades"));
const PerfilJogador = lazy(() => import("./pages/jogo/PerfilJogador"));
const LojaDiamantes = lazy(() => import("./pages/jogo/LojaDiamantes"));
const LojaMoedas = lazy(() => import("./pages/jogo/LojaMoedas"));

const TesteAcuidade = lazy(() => import("./pages/exercises/TesteAcuidade"));
const TesteContraste = lazy(() => import("./pages/exercises/TesteContraste"));
const TesteAstigmatismo = lazy(() => import("./pages/exercises/TesteAstigmatismo"));
const TesteEstereopsia = lazy(() => import("./pages/exercises/TesteEstereopsia"));
const TreinoAneis = lazy(() => import("./pages/exercises/TreinoAneis"));
const TreinoContrasteBlocos = lazy(() => import("./pages/exercises/TreinoContrasteBlocos"));
const TreinoConvergencia = lazy(() => import("./pages/exercises/TreinoConvergencia"));
const TreinoPertoLonge = lazy(() => import("./pages/exercises/TreinoPertoLonge"));
const ProgressoVisao = lazy(() => import("./pages/exercises/ProgressoVisao"));
const RelatorioSemanal = lazy(() => import("./pages/exercises/RelatorioSemanal"));
const RelatorioPartilhado = lazy(() => import("./pages/exercises/RelatorioPartilhado"));
const DashboardUser = lazy(() => import("./pages/DashboardUser"));
const DashboardPro = lazy(() => import("./pages/DashboardPro"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAtividade = lazy(() => import("./pages/admin/AdminAtividade"));
const AdminInbox = lazy(() => import("./pages/admin/AdminInbox"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminPublicacoes = lazy(() => import("./pages/admin/AdminPublicacoes"));
const AdminAdmins = lazy(() => import("./pages/admin/AdminAdmins"));
const AdminVoluntariado = lazy(() => import("./pages/admin/AdminVoluntariado"));
const AdminAgendamentos = lazy(() => import("./pages/admin/AdminAgendamentos"));
const AdminClinicas = lazy(() => import("./pages/admin/AdminClinicas"));
import GlobalBanner from "./components/GlobalBanner";
import { SiteBannerProvider } from "./contexts/SiteBannerContext";
import ScrollToTop from "./components/ScrollToTop";
import NotFound from "./pages/NotFound";

// Laboratório de identidade do redesenho (Sprint 7): só em desenvolvimento.
// Em produção `import.meta.env.DEV` é false e o import desaparece do build.
const Laboratorio = import.meta.env.DEV ? lazy(() => import("./redesenho/laboratorio/Laboratorio")) : null;
const Montra = import.meta.env.DEV ? lazy(() => import("./design/montra/Montra")) : null;
// Rastreio completo (motor próprio): publicado a 2026-10-07 a pedido do dono do
// projecto para testar com voluntários. Está só "escondido": fora dos menus, do
// sitemap e dos motores de busca (noindex), com o aviso "versão de teste".
const RastreioCompleto = lazy(() => import("./pages/RastreioCompleto"));
const Prototipos = import.meta.env.DEV ? lazy(() => import("./design/montra/prototipos/Prototipos")) : null;
import IdiomaDaRota from "./i18n/IdiomaDaRota";
import { inglesAtivo } from "./i18n/idiomas";
import { ALIASES_PT, EXERCICIOS_RETIRADOS, ROTAS, ROTAS_BILINGUES, type ChaveRota } from "./i18n/rotas";

/**
 * Páginas públicas ainda por redesenhar que já usam o cabeçalho e o rodapé
 * novos (transição, docs/REDESENHO_FRONTEND.md): o site público fica coerente
 * de ponta a ponta. As páginas da conta (painel, definições, jogo, exercícios)
 * ficam com o cabeçalho antigo até ao arquétipo App (Fase 4), que tem o menu de
 * conta e as notificações. Cada página sai daqui quando for redesenhada.
 */
const PAGINAS_SITE: ReadonlySet<ChaveRota> = new Set<ChaveRota>([
  "sobre",
  "equipa",
  "kamba",
  "campanhaGamek",
  "publicacoes",
  "publicacaoDetalhe",
  "parceiros",
  "portalClinico",
  "portalClinicoOptioptika",
  "tecnologia",
  "circular",
  "suporte",
  "exercicios",
  "apoiar",
  "politicaPrivacidade",
  "termosUtilizacao",
  "faq",
  "impacto",
  "junteSe",
  "jogoMenu",
  "jogoLoja",
  "jogoLojaMoedas",
]);

const pagina = (chave: ChaveRota) =>
  PAGINAS_SITE.has(chave) ? <EstruturaSite>{PAGINAS[chave]}</EstruturaSite> : PAGINAS[chave];

/**
 * Que componente renderiza cada página do mapa de rotas (`src/i18n/rotas.ts`).
 * O `Record` obriga a que toda a chave do mapa tenha aqui uma página.
 */
const PAGINAS: Record<ChaveRota, ReactElement> = {
  inicio: <Inicio />,
  sobre: <Sobre />,
  equipa: <Equipa />,
  kamba: <Kamba />,
  campanhaGamek: <CampanhaGamek />,
  publicacoes: <Publicacoes />,
  publicacaoDetalhe: <PublicacaoDetalhe />,
  parceiros: <Parceiros />,
  portalClinico: <Parceiros />,
  portalClinicoOptioptika: <PortalClinicoOptioptika />,
  tecnologia: <Tecnologia />,
  circular: <Circular />,
  suporte: <Suporte />,
  exercicios: <Exercicios />,
  exercicioAcuidade: <TesteAcuidade />,
  exercicioContraste: <TesteContraste />,
  exercicioAstigmatismo: <TesteAstigmatismo />,
  exercicioEstereopsia: <TesteEstereopsia />,
  exercicioAneis: <TreinoAneis />,
  exercicioContrasteBlocos: <TreinoContrasteBlocos />,
  exercicioConvergencia: <TreinoConvergencia />,
  exercicioPertoLonge: <TreinoPertoLonge />,
  exerciciosProgresso: <ProgressoVisao />,
  exerciciosRelatorio: <RelatorioSemanal />,
  relatorioPartilhado: <RelatorioPartilhado />,
  scanner: <Scanner />,
  rastreioCompleto: <RastreioCompleto />,
  scannerResultados: <ScannerResultados />,
  marcarConsulta: <MarcarConsulta />,
  entrar: <Auth />,
  atualizarPassword: <AtualizarPassword />,
  confirmarEmail: <ConfirmarEmail />,
  apoiar: <Apoiar />,
  configuracoes: <Configuracoes />,
  editarPerfil: <EditarPerfil />,
  politicaPrivacidade: <PoliticaPrivacidade />,
  termosUtilizacao: <TermosUtilizacao />,
  faq: <Faq />,
  impacto: <Impacto />,
  junteSe: <JunteSe />,
  registoPremium: <RegistoPremium />,
  testeSeteDias: <TesteSeteDias />,
  dashboard: <DashboardUser />,
  dashboardPro: <DashboardPro />,
  jogoMenu: <MenuJogo />,
  jogoJogar: <JogoCuriosidades />,
  jogoPerfil: <PerfilJogador />,
  jogoLoja: <LojaDiamantes />,
  jogoLojaMoedas: <LojaMoedas />,
};

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ProfileProvider>
          <AcessoExerciciosProvider>
          <CarteiraJogoProvider>
          <FeedbackProvider>
            <BrowserRouter>
              <ConsentimentoSaudeProvider>
              <SiteBannerProvider>
              <ScrollToTop />
              <IdiomaDaRota>
              <GlobalBanner />
              {/* Cada página chega no seu próprio ficheiro (divisão por rotas): o
                  pacote inicial leva só a página inicial e a estrutura. */}
              <Suspense fallback={<CarregarPagina />}>
              <Routes>
                {ROTAS.map((r) => (
                  <Route key={r.chave} path={r.pt} element={pagina(r.chave)} />
                ))}
                {ALIASES_PT.map((a) => (
                  <Route key={a.pt} path={a.pt} element={pagina(a.chave)} />
                ))}
                {/* Exercícios retirados (2026-09-28): redireccionam para a lista, na mesma língua. */}
                {EXERCICIOS_RETIRADOS.map((r) => (
                  <Route key={r.pt} path={r.pt} element={<Navigate to="/exercicios" replace />} />
                ))}
                {/* Versão inglesa: só existe com VITE_ENABLE_EN=true; sem ela, /en/* cai no 404. Páginas só em PT (jogo) não têm rota inglesa. */}
                {inglesAtivo() &&
                  ROTAS_BILINGUES.map((r) => (
                    <Route key={`en:${r.chave}`} path={r.en} element={pagina(r.chave)} />
                  ))}
                {inglesAtivo() &&
                  EXERCICIOS_RETIRADOS.map((r) => (
                    <Route key={r.en} path={r.en} element={<Navigate to="/en/exercises" replace />} />
                  ))}
                {/* Internas, só em português -- de propósito fora do mapa de rotas. */}
                <Route path="/roadmap-tecnico" element={<RoadmapTecnico />} />
                {Laboratorio && (
                  <Route
                    path="/_laboratorio"
                    element={
                      <Suspense fallback={null}>
                        <Laboratorio />
                      </Suspense>
                    }
                  />
                )}
                {Montra && (
                  <Route
                    path="/_montra"
                    element={
                      <Suspense fallback={null}>
                        <Montra />
                      </Suspense>
                    }
                  />
                )}
                {Prototipos && (
                  <Route
                    path="/_montra/prototipos/:qual"
                    element={
                      <Suspense fallback={null}>
                        <Prototipos />
                      </Suspense>
                    }
                  />
                )}

                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="utilizadores" element={<AdminUsers />} />
                  <Route path="atividade" element={<AdminAtividade />} />
                  <Route path="mensagens" element={<AdminInbox />} />
                  <Route path="banners" element={<AdminBanners />} />
                  <Route path="notificacoes" element={<AdminNotifications />} />
                  <Route path="publicacoes" element={<AdminPublicacoes />} />
                  <Route path="administradores" element={<AdminAdmins />} />
                  <Route path="voluntariado" element={<AdminVoluntariado />} />
                  <Route path="agendamentos" element={<AdminAgendamentos />} />
                  <Route path="clinicas" element={<AdminClinicas />} />
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </IdiomaDaRota>
              </SiteBannerProvider>
              </ConsentimentoSaudeProvider>
            </BrowserRouter>
          </FeedbackProvider>
          </CarteiraJogoProvider>
          </AcessoExerciciosProvider>
        </ProfileProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;