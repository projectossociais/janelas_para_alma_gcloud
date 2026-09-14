import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { FeedbackProvider } from "@/contexts/FeedbackContext";
import Index from "./pages/Index";
import Sobre from "./pages/Sobre";
import Equipa from "./pages/Equipa";
import Kamba from "./pages/Kamba";
import CampanhaGamek from "./pages/CampanhaGamek";
import Parceiros from "./pages/Parceiros";
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
import Politicas from "./pages/Politicas";
import Impacto from "./pages/Impacto";
import JunteSe from "./pages/JunteSe";
import RegistoPremium from "./pages/RegistoPremium";
import RoadmapTecnico from "./pages/RoadmapTecnico";

import ConvergenciaExercise from "./pages/exercises/ConvergenciaExercise";
import CerebroExercise from "./pages/exercises/CerebroExercise";
import TrackingExercise from "./pages/exercises/TrackingExercise";
import RelaxamentoExercise from "./pages/exercises/RelaxamentoExercise";
import AmbliopiaExercise from "./pages/exercises/AmbliopiaExercise";
import SacadasConvergenciaExercise from "./pages/exercises/SacadasConvergenciaExercise";
import FlexibilidadeAcomodativaExercise from "./pages/exercises/FlexibilidadeAcomodativaExercise";
import SacadasDistratoresExercise from "./pages/exercises/SacadasDistratoresExercise";
import EstereopsiaExercise from "./pages/exercises/EstereopsiaExercise";
import FacilidadeVergenciaExercise from "./pages/exercises/FacilidadeVergenciaExercise";
import ConscienciaPerifericaExercise from "./pages/exercises/ConscienciaPerifericaExercise";
import ProgramaIaExercise from "./pages/exercises/ProgramaIaExercise";
import DashboardUser from "./pages/DashboardUser";
import DashboardPro from "./pages/DashboardPro";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminInbox from "./pages/admin/AdminInbox";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminContent from "./pages/admin/AdminContent";
import AdminAdmins from "./pages/admin/AdminAdmins";
import GlobalBanner from "./components/GlobalBanner";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ProfileProvider>
          <FeedbackProvider>
            <BrowserRouter>
              <GlobalBanner />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/equipa" element={<Equipa />} />
                <Route path="/kamba" element={<Kamba />} />
                <Route path="/meu-kamba/campanha-gamek" element={<CampanhaGamek />} />
                <Route path="/parceiros" element={<Parceiros />} />
                <Route path="/tecnologia" element={<Tecnologia />} />
                <Route path="/circular" element={<Circular />} />
                <Route path="/suporte" element={<Suporte />} />
                <Route path="/exercicios" element={<Exercicios />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/scanner/resultados" element={<ScannerResultados />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/registo" element={<Auth />} />
                <Route path="/atualizar-password" element={<AtualizarPassword />} />
                <Route path="/update-password" element={<AtualizarPassword />} />
                <Route path="/confirmar-email" element={<ConfirmarEmail />} />
                <Route path="/apoiar" element={<Apoiar />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/editar-perfil" element={<EditarPerfil />} />
                <Route path="/politicas" element={<Politicas />} />
                <Route path="/impacto" element={<Impacto />} />
                <Route path="/junte-se" element={<JunteSe />} />
                <Route path="/registo-premium" element={<RegistoPremium />} />
                <Route path="/dashboard" element={<DashboardUser />} />
                <Route path="/roadmap-tecnico" element={<RoadmapTecnico />} />
                <Route path="/dashboard-pro" element={<DashboardPro />} />

                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="utilizadores" element={<AdminUsers />} />
                  <Route path="mensagens" element={<AdminInbox />} />
                  <Route path="banners" element={<AdminBanners />} />
                  <Route path="notificacoes" element={<AdminNotifications />} />
                  <Route path="conteudo" element={<AdminContent />} />
                  <Route path="administradores" element={<AdminAdmins />} />
                </Route>

                <Route path="/exercicios/convergencia" element={<ConvergenciaExercise />} />
                <Route path="/exercicios/cerebro" element={<CerebroExercise />} />
                <Route path="/exercicios/tracking" element={<TrackingExercise />} />
                <Route path="/exercicios/relaxamento" element={<RelaxamentoExercise />} />
                <Route path="/exercicios/ambliopia" element={<AmbliopiaExercise />} />
                <Route path="/exercicios/sacadas-convergencia" element={<SacadasConvergenciaExercise />} />
                <Route path="/exercicios/flexibilidade-acomodativa" element={<FlexibilidadeAcomodativaExercise />} />
                <Route path="/exercicios/sacadas-distratores" element={<SacadasDistratoresExercise />} />
                <Route path="/exercicios/estereopsia" element={<EstereopsiaExercise />} />
                <Route path="/exercicios/facilidade-vergencia" element={<FacilidadeVergenciaExercise />} />
                <Route path="/exercicios/consciencia-periferica" element={<ConscienciaPerifericaExercise />} />
                <Route path="/exercicios/programa-ia" element={<ProgramaIaExercise />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </FeedbackProvider>
        </ProfileProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;