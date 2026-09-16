import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { publicacoesApi, type PublicacaoPublica } from "@/lib/apiClient";

// ADMIN-03: já não é uma única campanha escrita directamente em código --
// mostra as publicações mais recentes geridas em /admin/publicacoes. Sem
// publicações ainda, a secção não aparece em vez de mostrar um exemplo
// inventado (nunca fingir dados que não existem).
const MAXIMO_A_MOSTRAR = 2;

const ActivitiesFeed = () => {
  const [publicacoes, setPublicacoes] = useState<PublicacaoPublica[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const todas = await publicacoesApi.listarPublicadas();
        setPublicacoes(todas.slice(0, MAXIMO_A_MOSTRAR));
      } catch {
        // Secção puramente informativa da home -- uma falha aqui não deve
        // interromper a página com um toast de erro, só não mostrar nada.
        setPublicacoes([]);
      }
    })();
  }, []);

  if (!publicacoes?.length) return null;

  return (
    <section id="acoes-recentes" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-4 mb-12">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Ações Recentes
          </span>
          <h2 className="text-3xl md:text-4xl font-bold">
            No Terreno com a Comunidade
          </h2>
        </div>

        <div className="grid gap-8 max-w-5xl mx-auto md:grid-cols-2">
          {publicacoes.map((p) => (
            <Card key={p.id} className="overflow-hidden shadow-elevated flex flex-col">
              <CardContent className="p-8 md:p-10 flex flex-col items-center text-center gap-6 flex-1">
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap justify-center">
                  {p.data_evento && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4" />
                      {new Date(p.data_evento).toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}
                    </span>
                  )}
                  {p.local && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {p.local}
                    </span>
                  )}
                </div>

                <h3 className="text-2xl font-bold">{p.titulo}</h3>

                <p className="text-muted-foreground leading-relaxed max-w-xl">{p.resumo}</p>

                {p.capa_url && (
                  <img
                    src={p.capa_url}
                    alt={p.titulo}
                    className="w-full max-w-xl mx-auto rounded-xl object-cover max-h-64"
                    loading="lazy"
                  />
                )}

                <Link
                  to={`/publicacoes/${p.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal text-teal-foreground font-bold shadow-elevated transition-all hover:opacity-90 hover:translate-y-[-2px]"
                >
                  <PlayCircle className="w-5 h-5" />
                  Ver Publicação Completa
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ActivitiesFeed;
