import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Loader2, Newspaper } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { publicacoesApi, mensagemDeErroApi, type PublicacaoPublica } from "@/lib/apiClient";
import { toast } from "sonner";

const Publicacoes = () => {
  const [publicacoes, setPublicacoes] = useState<PublicacaoPublica[]>([]);
  const [aCarregar, setACarregar] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setPublicacoes(await publicacoesApi.listarPublicadas());
      } catch (err) {
        toast.error(mensagemDeErroApi(err, "Não foi possível carregar as publicações."));
      } finally {
        setACarregar(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath="/" label="Voltar" />
      <main className="flex-1">
        <div className="container py-10">
          <header className="max-w-2xl mx-auto text-center space-y-4 mb-12">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              Ações Recentes
            </span>
            <h1 className="text-3xl md:text-4xl font-bold">No Terreno com a Comunidade</h1>
            <p className="text-muted-foreground">
              Actividades, campanhas e notícias do Janelas Para a Alma.
            </p>
          </header>

          {aCarregar && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!aCarregar && !publicacoes.length && (
            <div className="max-w-md mx-auto text-center py-16 space-y-3">
              <Newspaper className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Ainda não há publicações. Volte em breve para acompanhar as nossas actividades.
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {publicacoes.map((p) => (
              <Link key={p.id} to={`/publicacoes/${p.slug}`}>
                <Card className="h-full overflow-hidden shadow-elevated hover:-translate-y-1 transition-transform">
                  {p.capa_url && (
                    <img src={p.capa_url} alt={p.titulo} className="w-full h-44 object-cover" loading="lazy" />
                  )}
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {p.data_evento && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {new Date(p.data_evento).toLocaleDateString("pt-PT")}
                        </span>
                      )}
                      {p.local && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {p.local}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold leading-snug">{p.titulo}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-3">{p.resumo}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Publicacoes;
