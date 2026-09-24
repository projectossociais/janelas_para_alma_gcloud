import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Play, Swords, Trophy } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { toast } from "sonner";
import { TOTAL_PATAMARES, formatarKz, valorDoPatamar } from "./jogoConfig";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

const PerfilJogador = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { perfil: perfilJogo, aCarregar: aCarregarCarteira, erro } = useCarteiraJogo();
  // Antes do primeiro pedido, o contexto ainda não está "a carregar" -- sem
  // isto a página mostraria zeros por um instante.
  const aCarregar = aCarregarCarteira || (!perfilJogo && !erro);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate(localizar("/auth"));
  }, [authLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (erro) toast.error(t("PerfilJogador.naoFoiPossivelCarregar"));
  }, [erro, t]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/jogo-curiosidades")} label={t("PerfilJogador.voltarAoMenu")} />

      <main className="flex-1">
        <div className="container pb-16 max-w-2xl mx-auto">
          <header className="text-center space-y-3 mb-8">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              {t("PerfilJogador.inclusivamente")}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("PerfilJogador.oMeuPerfil")}</h1>
          </header>

          <div className="flex justify-center mb-6">
            <CarteiraJogo />
          </div>

          {profile && (
            <div className="flex flex-col items-center gap-3 mb-8">
              <Avatar className="h-20 w-20">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.nome_completo} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                  {(profile.nome_completo || profile.email)[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <p className="text-lg font-bold text-foreground">{profile.nome_completo || profile.email}</p>
            </div>
          )}

          {aCarregar ? (
            <div className="rounded-2xl bg-card border border-border/60 shadow-card p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-card border border-border/60 shadow-card p-5 text-center space-y-2">
                  <Swords className="w-6 h-6 text-navy mx-auto" />
                  <p className="text-2xl font-bold text-foreground">{perfilJogo?.partidas_jogadas ?? 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("PerfilJogador.partidasJogadas")}</p>
                </div>
                <div className="rounded-2xl bg-card border border-border/60 shadow-card p-5 text-center space-y-2">
                  <Trophy className="w-6 h-6 text-navy mx-auto" />
                  <p className="text-2xl font-bold text-foreground">
                    {perfilJogo?.patamar_maximo_alcancado ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {TOTAL_PATAMARES}</span>
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("PerfilJogador.melhorPatamar")}</p>
                </div>
              </div>

              {!!perfilJogo?.patamar_maximo_alcancado && (
                <div className="rounded-2xl bg-teal/5 border border-teal/30 p-5 text-center">
                  <p className="text-sm text-muted-foreground">{t("PerfilJogador.oSeuMelhorResultado")}</p>
                  <p className="text-2xl font-bold text-gold">{formatarKz(valorDoPatamar(perfilJogo.patamar_maximo_alcancado))}</p>
                </div>
              )}

              <Button asChild size="lg" className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
                <Link to={localizar("/jogo-curiosidades/jogar")}>
                  <Play className="w-4 h-4" />
                  {t("PerfilJogador.jogarAgora")}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PerfilJogador;
