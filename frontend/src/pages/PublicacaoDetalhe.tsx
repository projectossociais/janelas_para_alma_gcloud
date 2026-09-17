import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { publicacoesApi, mensagemDeErroApi, type PublicacaoPublica } from "@/lib/apiClient";
import { toast } from "sonner";

const INTERVALO_CARROSSEL_MS = 10_000;

const PublicacaoDetalhe = () => {
  const { slug } = useParams<{ slug: string }>();
  const [publicacao, setPublicacao] = useState<PublicacaoPublica | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [aCarregar, setACarregar] = useState(true);
  // `stopOnInteraction: false` -- depois de a pessoa arrastar/clicar numa
  // seta, o carrossel volta a andar sozinho passado o mesmo intervalo, em
  // vez de ficar parado para sempre (comportamento por omissão do plugin).
  const autoplay = useRef(Autoplay({ delay: INTERVALO_CARROSSEL_MS, stopOnInteraction: false }));

  useEffect(() => {
    if (!slug) return;
    setACarregar(true);
    setNaoEncontrada(false);
    (async () => {
      try {
        setPublicacao(await publicacoesApi.obterPorSlug(slug));
      } catch (err) {
        // Duck-typing na propriedade `status`, não `instanceof ApiError` --
        // este módulo é mockado nos testes de página (ver CLAUDE.md, "Testes
        // (Vitest)"), e uma classe importada de um módulo mockado não passa
        // fiavelmente num `instanceof`.
        if ((err as { status?: unknown } | null)?.status === 404) {
          setNaoEncontrada(true);
        } else {
          toast.error(mensagemDeErroApi(err, "Não foi possível carregar esta publicação."));
        }
      } finally {
        setACarregar(false);
      }
    })();
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath="/publicacoes" label="Voltar às publicações" />
      <main className="flex-1">
        <div className="container py-10">
          {aCarregar && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!aCarregar && naoEncontrada && (
            <div className="max-w-md mx-auto text-center py-16 space-y-4">
              <h1 className="text-2xl font-bold">Publicação não encontrada</h1>
              <p className="text-muted-foreground">
                Esta publicação pode ter sido removida ou ainda não foi publicada.
              </p>
              <Link to="/publicacoes" className="text-teal font-medium hover:underline">
                Ver todas as publicações
              </Link>
            </div>
          )}

          {!aCarregar && publicacao && (
            <article className="max-w-3xl mx-auto flex flex-col gap-8">
              <header className="text-center space-y-3">
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap">
                  {publicacao.data_evento && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4" />
                      {new Date(publicacao.data_evento).toLocaleDateString("pt-PT")}
                    </span>
                  )}
                  {publicacao.local && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {publicacao.local}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">{publicacao.titulo}</h1>
                <p className="text-muted-foreground text-lg">{publicacao.resumo}</p>
              </header>

              {publicacao.capa_url && (
                <div className="w-full max-h-[420px] rounded-2xl shadow-elevated overflow-hidden bg-muted">
                  <img
                    src={publicacao.capa_url}
                    alt={publicacao.titulo}
                    // `object-contain` -- nunca corta a foto (era `object-cover`
                    // com uma altura fixa, que recortava sempre que a foto não
                    // tivesse exactamente a mesma proporção da caixa).
                    className="w-full max-h-[420px] object-contain"
                  />
                </div>
              )}

              <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap max-w-2xl mx-auto">
                {publicacao.corpo}
              </div>

              {publicacao.midias.length > 0 && (
                <div className="space-y-4">
                  <hr className="border-slate-200" />
                  <h2 className="text-xl font-bold text-center">Galeria de Fotos</h2>
                  <Carousel
                    opts={{ loop: true }}
                    plugins={[autoplay.current]}
                    className="max-w-lg mx-auto"
                  >
                    <CarouselContent>
                      {publicacao.midias.map((m) => (
                        <CarouselItem key={m.id}>
                          <img
                            src={m.url}
                            alt={publicacao.titulo}
                            className="w-full aspect-square object-cover rounded-xl"
                            loading="lazy"
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {publicacao.midias.length > 1 && (
                      <>
                        <CarouselPrevious />
                        <CarouselNext />
                      </>
                    )}
                  </Carousel>
                </div>
              )}
            </article>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PublicacaoDetalhe;
