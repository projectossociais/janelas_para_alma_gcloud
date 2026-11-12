import { Link } from "react-router-dom";
import { Globe, User, Users, UserRound } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/contexts/ProfileContext";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

const MenuJogo = () => {
  const { t } = useTranslation();
  const { profile } = useProfile();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/")} label={t("MenuJogo.voltar")} />

      <main className="flex-1">
        <div className="container pb-16">
          <header className="max-w-2xl mx-auto text-center space-y-3 mb-8">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              {t("MenuJogo.inclusivamente")}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("MenuJogo.oJogoDaSaude")}</h1>
            <p className="text-muted-foreground">{t("MenuJogo.escolhaComoQuerJogar")}</p>
          </header>

          {/* Cabeçalho do jogador -- avatar/nome e saldos */}
          <div className="max-w-3xl mx-auto rounded-2xl bg-card border border-border/60 shadow-card p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap mb-8">
            {profile ? (
              <Link to={localizar("/jogo-curiosidades/perfil")} className="flex items-center gap-3 group min-w-0">
                <Avatar className="h-12 w-12 shrink-0">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.nome_completo} />}
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {(profile.nome_completo || profile.email)[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-foreground group-hover:text-teal transition-colors truncate">
                    {profile.nome_completo || profile.email}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("MenuJogo.verPerfilEEstatisticas")}</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 shrink-0 rounded-full bg-muted flex items-center justify-center">
                  <UserRound className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground">{t("MenuJogo.convidado")}</p>
                  <Link to={localizar("/auth")} className="text-xs text-teal hover:underline">
                    {t("MenuJogo.inicieSessaoParaGuardar")}
                  </Link>
                </div>
              </div>
            )}

            <CarteiraJogo className="shrink-0" />
          </div>

          {/* Modos de jogo */}
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <Link
              to={localizar("/jogo-curiosidades/jogar")}
              className="group rounded-2xl bg-card border border-border/60 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all p-6 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal flex items-center justify-center mx-auto transition-colors group-hover:bg-teal group-hover:text-teal-foreground">
                <User className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground">{t("MenuJogo.umJogador")}</h3>
              <p className="text-sm text-muted-foreground">{t("MenuJogo.subaOs15Patamares")}</p>
            </Link>

            <Link
              to={localizar("/jogo-curiosidades/local")}
              className="group rounded-2xl bg-card border border-border/60 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all p-6 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal flex items-center justify-center mx-auto transition-colors group-hover:bg-teal group-hover:text-teal-foreground">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground">{t("MenuJogo.multijogadorLocal")}</h3>
              <p className="text-sm text-muted-foreground">{t("MenuJogo.desafieUmAmigoNo")}</p>
            </Link>

            <Link
              to={localizar("/jogo-curiosidades/online")}
              className="group rounded-2xl bg-card border border-border/60 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all p-6 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal flex items-center justify-center mx-auto transition-colors group-hover:bg-teal group-hover:text-teal-foreground">
                <Globe className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground">{t("MenuJogo.multijogadorOnline")}</h3>
              <p className="text-sm text-muted-foreground">{t("MenuJogo.jogueEmTempoReal")}</p>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MenuJogo;
