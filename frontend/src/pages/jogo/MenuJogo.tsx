import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Gem, Globe, Loader2, User, Users, UserRound } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/contexts/ProfileContext";
import { jogoApi, type PerfilJogadorPublico } from "@/lib/apiClient";

type ModoEmBreve = "local" | "online" | null;

const MenuJogo = () => {
  const { profile } = useProfile();
  const [perfilJogo, setPerfilJogo] = useState<PerfilJogadorPublico | null>(null);
  const [aCarregarPerfilJogo, setACarregarPerfilJogo] = useState(false);
  const [modoEmBreve, setModoEmBreve] = useState<ModoEmBreve>(null);

  useEffect(() => {
    if (!profile?.id) {
      setPerfilJogo(null);
      return;
    }
    let cancelado = false;
    setACarregarPerfilJogo(true);
    jogoApi
      .obterPerfil()
      .then((p) => {
        if (!cancelado) setPerfilJogo(p);
      })
      .catch((err: unknown) => {
        // Sem bloquear o Lobby -- se falhar, os saldos ficam a "0" e o
        // jogador continua a conseguir jogar normalmente.
        console.error("Falha ao carregar o perfil do jogo:", err);
      })
      .finally(() => {
        if (!cancelado) setACarregarPerfilJogo(false);
      });
    return () => {
      cancelado = true;
    };
  }, [profile?.id]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath="/" label="Voltar" />

      <main className="flex-1">
        <div className="container pb-16">
          <header className="max-w-2xl mx-auto text-center space-y-3 mb-8">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Inclusivamente
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">O Jogo da Saúde Ocular</h1>
            <p className="text-muted-foreground">Escolha como quer jogar e comece a subir a escada.</p>
          </header>

          {/* Cabeçalho do jogador -- avatar/nome e saldos */}
          <div className="max-w-3xl mx-auto rounded-2xl bg-card border border-border/60 shadow-card p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap mb-8">
            {profile ? (
              <Link to="/jogo-curiosidades/perfil" className="flex items-center gap-3 group min-w-0">
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
                  <p className="text-xs text-muted-foreground">Ver perfil e estatísticas</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 shrink-0 rounded-full bg-muted flex items-center justify-center">
                  <UserRound className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground">Convidado</p>
                  <Link to="/auth" className="text-xs text-teal hover:underline">
                    Inicie sessão para guardar o seu progresso
                  </Link>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 shrink-0">
              <span className="inline-flex items-center gap-1.5 font-bold text-gold" aria-label="Moedas">
                <Coins className="w-5 h-5" />
                {aCarregarPerfilJogo ? <Loader2 className="w-4 h-4 animate-spin" /> : (perfilJogo?.moedas ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-teal" aria-label="Diamantes">
                <Gem className="w-5 h-5" />
                {aCarregarPerfilJogo ? <Loader2 className="w-4 h-4 animate-spin" /> : (perfilJogo?.diamantes ?? 0)}
              </span>
            </div>
          </div>

          {/* Modos de jogo */}
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <Link
              to="/jogo-curiosidades/jogar"
              className="group rounded-2xl bg-card border border-border/60 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all p-6 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal flex items-center justify-center mx-auto transition-colors group-hover:bg-teal group-hover:text-teal-foreground">
                <User className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground">Um Jogador</h3>
              <p className="text-sm text-muted-foreground">Suba os 15 patamares sozinho, ao seu ritmo.</p>
            </Link>

            <button
              type="button"
              onClick={() => setModoEmBreve("local")}
              className="relative rounded-2xl bg-card border border-border/60 shadow-card hover:shadow-elevated transition-all p-6 text-center space-y-3"
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-gold/15 text-gold rounded-full px-2 py-1">
                Em breve
              </span>
              <div className="w-14 h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground">Multijogador Local</h3>
              <p className="text-sm text-muted-foreground">Desafie um amigo no mesmo dispositivo.</p>
            </button>

            <button
              type="button"
              onClick={() => setModoEmBreve("online")}
              className="relative rounded-2xl bg-card border border-border/60 shadow-card hover:shadow-elevated transition-all p-6 text-center space-y-3"
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-gold/15 text-gold rounded-full px-2 py-1">
                Em breve
              </span>
              <div className="w-14 h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                <Globe className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground">Multijogador Online</h3>
              <p className="text-sm text-muted-foreground">Jogue em tempo real contra outros jogadores.</p>
            </button>
          </div>
        </div>
      </main>

      <Dialog open={modoEmBreve !== null} onOpenChange={(open) => !open && setModoEmBreve(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modoEmBreve === "online" ? "Multijogador Online" : "Multijogador Local"}</DialogTitle>
            <DialogDescription>
              {modoEmBreve === "online"
                ? "Estamos a construir o sistema de salas para desafiar outros jogadores em tempo real. Volte em breve!"
                : "Em breve vai poder desafiar um amigo no mesmo dispositivo, à vez, na mesma escada de perguntas."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setModoEmBreve(null)}
              className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default MenuJogo;
