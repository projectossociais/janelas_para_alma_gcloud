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
import Index from "./pages/Index";
import Sobre from "./pages/Sobre";
import Equipa from "./pages/Equipa";
import Kamba from "./pages/Kamba";
import CampanhaGamek from "./pages/CampanhaGamek";
import Publicacoes from "./pages/Publicacoes";
import PublicacaoDetalhe from "./pages/PublicacaoDetalhe";
import Parceiros from "./pages/Parceiros";
import PortalClinicoOptioptika from "./pages/PortalClinicoOptioptika";
import Tecnologia from "./pages/Tecnologia";
import Circular from "./pages/Circular";
import Suporte from "./pages/Suporte";
import Exercicios from "./pages/Exercicios";
import Scanner from "./pages/Scanner";
import ScannerResultados from "./pages/ScannerResultados";
import Auth from "./pages/Auth";
import AtualizarPassword from "./pages/AtualizarPassword";
import ConfirmarEmail from "./pages/ConfirmarEmail";
import Apoiar from "./pages/Apoiar";
import Configuracoes from "./pages/Configuracoes";
import EditarPerfil from "./pages/EditarPerfil";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosUtilizacao from "./pages/TermosUtilizacao";
import Faq from "./pages/Faq";
import Impacto from "./pages/Impacto";
import JunteSe from "./pages/JunteSe";
import RegistoPremium from "./pages/RegistoPremium";
import RoadmapTecnico from "./pages/RoadmapTecnico";
import MenuJogo from "./pages/jogo/MenuJogo";
import JogoCuriosidades from "./pages/jogo/JogoCuriosidades";
import PerfilJogador from "./pages/jogo/PerfilJogador";
import LojaDiamantes from "./pages/jogo/LojaDiamantes";
import LojaMoedas from "./pages/jogo/LojaMoedas";

import TesteAcuidade from "./pages/exercises/TesteAcuidade";
import TesteContraste from "./pages/exercises/TesteContraste";
import TesteAstigmatismo from "./pages/exercises/TesteAstigmatismo";
import TesteEstereopsia from "./pages/exercises/TesteEstereopsia";
import TreinoAneis from "./pages/exercises/TreinoAneis";
import TreinoContrasteBlocos from "./pages/exercises/TreinoContrasteBlocos";
import TreinoConvergencia from "./pages/exercises/TreinoConvergencia";
import TreinoPertoLonge from "./pages/exercises/TreinoPertoLonge";
import ProgressoVisao from "./pages/exercises/ProgressoVisao";
import RelatorioSemanal from "./pages/exercises/RelatorioSemanal";
import RelatorioPartilhado from "./pages/exercises/RelatorioPartilhado";
import DashboardUser from "./pages/DashboardUser";
import DashboardPro from "./pages/DashboardPro";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAtividade from "./pages/admin/AdminAtividade";
import AdminInbox from "./pages/admin/AdminInbox";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminPublicacoes from "./pages/admin/AdminPublicacoes";
import AdminAdmins from "./pages/admin/AdminAdmins";
import AdminVoluntariado from "./pages/admin/AdminVoluntariado";
import AdminAgendamentos from "./pages/admin/AdminAgendamentos";
import AdminClinicas from "./pages/admin/AdminClinicas";
import GlobalBanner from "./components/GlobalBanner";
import { SiteBannerProvider } from "./contexts/SiteBannerContext";
import ScrollToTop from "./components/ScrollToTop";
import NotFound from "./pages/NotFound";
import IdiomaDaRota from "./i18n/IdiomaDaRota";
import { inglesAtivo } from "./i18n/idiomas";
import { ALIASES_PT, EXERCICIOS_RETIRADOS, ROTAS, ROTAS_BILINGUES, type ChaveRota } from "./i18n/rotas";

/**
 * Que componente renderiza cada página do mapa de rotas (`src/i18n/rotas.ts`).
 * O `Record` obriga a que toda a chave do mapa tenha aqui uma página.
 */
const PAGINAS: Record<ChaveRota, ReactElement> = {
  inicio: <Index />,
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
  scannerResultados: <ScannerResultados />,
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
              <Routes>
                {ROTAS.map((r) => (
                  <Route key={r.chave} path={r.pt} element={PAGINAS[r.chave]} />
                ))}
                {ALIASES_PT.map((a) => (
                  <Route key={a.pt} path={a.pt} element={PAGINAS[a.chave]} />
                ))}
                {/* Exercícios retirados (2026-09-28): redireccionam para a lista, na mesma língua. */}
                {EXERCICIOS_RETIRADOS.map((r) => (
                  <Route key={r.pt} path={r.pt} element={<Navigate to="/exercicios" replace />} />
                ))}
                {/* Versão inglesa: só existe com VITE_ENABLE_EN=true; sem ela, /en/* cai no 404. Páginas só em PT (jogo) não têm rota inglesa. */}
                {inglesAtivo() &&
                  ROTAS_BILINGUES.map((r) => (
                    <Route key={`en:${r.chave}`} path={r.en} element={PAGINAS[r.chave]} />
                  ))}
                {inglesAtivo() &&
                  EXERCICIOS_RETIRADOS.map((r) => (
                    <Route key={r.en} path={r.en} element={<Navigate to="/en/exercises" replace />} />
                  ))}
                {/* Internas, só em português -- de propósito fora do mapa de rotas. */}
                <Route path="/roadmap-tecnico" element={<RoadmapTecnico />} />

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