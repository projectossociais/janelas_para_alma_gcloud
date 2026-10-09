import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  HeartHandshake,
  Inbox,
  MessageSquare,
  ScanEye,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EstadoDadosAdmin, useDadosAdmin } from "@/components/admin/DadosAdmin";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { cn } from "@/design/cn";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import { adminApi } from "@/lib/apiClient";

type Periodo = "week" | "month" | "year";

const DIAS: Record<Periodo, number> = { week: 7, month: 30, year: 365 };
const NOME_PERIODO: Record<Periodo, string> = { week: "esta semana", month: "este mês", year: "este ano" };

/** Um número com o seu nome; com `href`, o cartão leva à lista que o explica. */
const Metrica = ({ icone, valor, rotulo, href, nota }: { icone: ReactNode; valor: string; rotulo: string; href?: string; nota?: string }) => {
  const conteudo = (
    <>
      <span aria-hidden className="text-tinta-suave [&_svg]:size-5">
        {icone}
      </span>
      <span className="mt-2 block text-titulo-p font-medium tabular-nums text-tinta">{valor}</span>
      <span className="mt-0.5 block text-legenda text-tinta-suave">{rotulo}</span>
      {nota && <span className="mt-1 block text-legenda text-tinta-suave">{nota}</span>}
    </>
  );
  const base = "block h-full rounded-cartao border border-linha bg-superficie p-4";
  return href ? (
    <Link
      to={href}
      className={cn(
        base,
        "transition-colors duration-feedback hover:border-accao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
      )}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={base}>{conteudo}</div>
  );
};

const AdminOverview = () => {
  const [periodo, setPeriodo] = useState<Periodo>("month");
  const estatisticas = useDadosAdmin(
    () => adminApi.obterEstatisticas(DIAS[periodo]),
    "Não foi possível carregar as estatísticas.",
    [periodo],
  );
  const pendencias = useDadosAdmin(() => adminApi.obterPendencias(), "Não foi possível carregar as pendências.", []);

  const s = estatisticas.dados;
  // Sem dados, "—": nunca 0, que seria um número inventado.
  const n = (v: number | undefined) => (s && typeof v === "number" ? String(v) : "—");

  const p = pendencias.dados;
  const itensPendencias = [
    {
      rotulo: "Pedidos Premium por decidir",
      valor: p?.pedidos_premium_pendentes ?? 0,
      href: "/admin/mensagens?tab=premium",
      icone: <Sparkles />,
    },
    { rotulo: "Mensagens por ler", valor: p?.mensagens_por_ler ?? 0, href: "/admin/mensagens?tab=messages", icone: <Inbox /> },
    {
      rotulo: "Candidaturas de voluntariado por decidir",
      valor: p?.candidaturas_voluntariado_pendentes ?? 0,
      href: "/admin/voluntariado",
      icone: <HeartHandshake />,
    },
  ];
  const totalPendencias = itensPendencias.reduce((soma, i) => soma + i.valor, 0);

  return (
    <>
      <CabecalhoConsola titulo="Visão geral" descricao="O que pede decisão agora e as métricas do período." />

      <section aria-labelledby="admin-pendencias">
        <h2 id="admin-pendencias" className="flex items-center gap-2 text-titulo-p text-tinta">
          Por decidir
          {p && totalPendencias > 0 && (
            <span className="rounded-pilula bg-aviso-suave px-2.5 py-0.5 text-legenda font-medium text-aviso">
              {totalPendencias}
            </span>
          )}
        </h2>
        <div className="mt-3">
          <EstadoDadosAdmin
            aCarregar={pendencias.aCarregar}
            erro={pendencias.erro}
            aoTentarDeNovo={() => void pendencias.recarregar()}
            temDados={!!p}
          >
            <ul className="grid gap-3 sm:grid-cols-3">
              {itensPendencias.map((i) => (
                <li key={i.rotulo}>
                  <Link
                    to={i.href}
                    className={cn(
                      "flex h-full items-center justify-between gap-3 rounded-cartao border bg-superficie p-4",
                      "transition-colors duration-feedback hover:border-accao",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
                      i.valor > 0 ? "border-aviso" : "border-linha",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="text-tinta-suave [&_svg]:size-5">
                        {i.icone}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-titulo-p font-medium tabular-nums text-tinta">{i.valor}</span>
                        <span className="block text-legenda text-tinta-suave">{i.rotulo}</span>
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-tinta-suave" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </EstadoDadosAdmin>
        </div>
      </section>

      <section aria-labelledby="admin-metricas" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="admin-metricas" className="text-titulo-p text-tinta">
            Métricas
          </h2>
          <GrupoEscolha<Periodo>
            legenda="Período"
            legendaOculta
            aparencia="pastilha"
            valor={periodo}
            aoMudar={setPeriodo}
            opcoes={[
              { valor: "week", rotulo: "Semanal" },
              { valor: "month", rotulo: "Mensal" },
              { valor: "year", rotulo: "Anual" },
            ]}
          />
        </div>

        <div className="mt-4">
          <EstadoDadosAdmin
            aCarregar={estatisticas.aCarregar}
            erro={estatisticas.erro}
            aoTentarDeNovo={() => void estatisticas.recarregar()}
            temDados={!!s}
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-busy={estatisticas.aCarregar}>
              <Metrica icone={<Users />} valor={n(s?.total_utilizadores)} rotulo="Utilizadores (total)" href="/admin/utilizadores" />
              <Metrica
                icone={<TrendingUp />}
                valor={n(s?.novos_utilizadores)}
                rotulo="Novos utilizadores"
                href={`/admin/utilizadores?dias=${DIAS[periodo]}`}
              />
              <Metrica
                icone={<UserCheck />}
                valor={n(s?.utilizadores_ativos_periodo)}
                rotulo={`Activos ${NOME_PERIODO[periodo]}`}
                href={`/admin/atividade?tab=ativos&dias=${DIAS[periodo]}`}
              />
              <Metrica
                icone={<Activity />}
                valor={n(s?.sessoes_exercicio)}
                rotulo="Sessões de exercício"
                href={`/admin/atividade?tab=sessoes&dias=${DIAS[periodo]}`}
              />
              {/* Conta `screenings` (admin_stats_repository.py); ainda sem página que os liste. */}
              <Metrica icone={<ScanEye />} valor={n(s?.analises_scanner)} rotulo="Rastreios" />
              <Metrica
                icone={<Sparkles />}
                valor={n(s?.pedidos_premium)}
                rotulo="Pedidos Premium"
                href="/admin/mensagens?tab=premium"
              />
              <Metrica
                icone={<MessageSquare />}
                valor={n(s?.mensagens_contacto)}
                rotulo="Mensagens"
                href="/admin/mensagens?tab=messages"
              />
            </div>

            <div className="mt-6 rounded-cartao border border-linha bg-superficie p-4">
              <h3 className="text-corpo font-medium text-tinta">Actividade por dia</h3>
              <ul className="mt-2 flex flex-wrap gap-4 text-legenda text-tinta-suave">
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-3 rounded-pequeno bg-accao" /> Registos
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-3 rounded-pequeno bg-acento" /> Sessões de exercício
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-3 rounded-pequeno bg-aviso" /> Pedidos Premium
                </li>
              </ul>
              <div className="mt-3 h-64" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s?.serie ?? []} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-linha" vertical={false} />
                    <XAxis
                      dataKey="dia"
                      tickFormatter={(d: string) => d.slice(5)}
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      stroke="currentColor"
                      className="text-tinta-suave"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      stroke="currentColor"
                      className="text-tinta-suave"
                    />
                    <Tooltip />
                    <Bar dataKey="registos" name="Registos" fill="currentColor" className="text-accao" />
                    <Bar dataKey="sessoes" name="Sessões de exercício" fill="currentColor" className="text-acento" />
                    <Bar dataKey="pedidos_premium" name="Pedidos Premium" fill="currentColor" className="text-aviso" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </EstadoDadosAdmin>
        </div>
      </section>
    </>
  );
};

export default AdminOverview;
