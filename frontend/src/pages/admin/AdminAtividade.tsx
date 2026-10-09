import { useSearchParams } from "react-router-dom";
import { EstadoDadosAdmin, useDadosAdmin } from "@/components/admin/DadosAdmin";
import { limiarFormatado, nomeDoExercicio, nomeDoOlho } from "@/components/visao/rotulos";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import {
  Estado,
  Tabela,
  TabelaCabecalho,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
  TabelaTitulo,
} from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import { formatarDataHora } from "@/i18n/formatar";
import { adminApi, type SessaoExercicioAdmin } from "@/lib/apiClient";

type Vista = "sessoes" | "ativos";

const minutosESegundos = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);

/**
 * O resultado de uma sessão como o exercício o mede. Versão 2 (sem webcam):
 * o limiar, como no progresso e no relatório. Versão 1: pontuação e precisão
 * dos exercícios antigos -- até 2026-10-09 eram as únicas colunas, e as
 * sessões novas apareciam todas com "0" e "0 %".
 */
const Resultado = ({ s }: { s: SessaoExercicioAdmin }) => {
  if (s.versao < 2)
    return (
      <span className="text-tinta-suave">
        {s.pontuacao} pts · {s.precisao_percentual.toFixed(0)} %
      </span>
    );
  const sinais = s.astigmatismo === null ? null : { astigmatismo: s.astigmatismo };
  return <>{limiarFormatado(s.limiar, s.unidade, sinais)}</>;
};

const AdminAtividade = () => {
  // A visão geral liga directamente à vista e ao período certos (ex.:
  // ?tab=sessoes&dias=7 a partir do cartão "Sessões de exercício" em
  // "Semanal"), para os números coincidirem com o cartão que trouxe aqui.
  const [searchParams, setSearchParams] = useSearchParams();
  const vista: Vista = searchParams.get("tab") === "ativos" ? "ativos" : "sessoes";
  const dias = Number(searchParams.get("dias")) || 30;

  const sessoes = useDadosAdmin(
    () => adminApi.listarSessoesExercicio(dias),
    "Não foi possível carregar as sessões de exercício.",
    [dias],
  );
  const ativos = useDadosAdmin(() => adminApi.listarAtivos(dias), "Não foi possível carregar os utilizadores activos.", [dias]);

  const mudarVista = (v: Vista) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", v);
    setSearchParams(p, { replace: true });
  };

  const contagem = (n: number | undefined) => (n === undefined ? "" : ` (${n})`);

  return (
    <>
      <CabecalhoConsola titulo="Actividade" descricao={`Últimos ${dias} dias.`} />

      <GrupoEscolha<Vista>
        legenda="Mostrar"
        legendaOculta
        aparencia="pastilha"
        valor={vista}
        aoMudar={mudarVista}
        opcoes={[
          { valor: "sessoes", rotulo: `Sessões de exercício${contagem(sessoes.dados?.length)}` },
          { valor: "ativos", rotulo: `Activos no período${contagem(ativos.dados?.length)}` },
        ]}
        className="mb-4"
      />

      {vista === "sessoes" ? (
        <EstadoDadosAdmin
          aCarregar={sessoes.aCarregar}
          erro={sessoes.erro}
          aoTentarDeNovo={() => void sessoes.recarregar()}
          temDados={!!sessoes.dados}
        >
          <Tabela legenda="Sessões de exercício">
            <TabelaCabecalho>
              <TabelaLinha>
                <TabelaTitulo>Utilizador</TabelaTitulo>
                <TabelaTitulo>Exercício</TabelaTitulo>
                <TabelaTitulo>Olho</TabelaTitulo>
                <TabelaTitulo>Resultado</TabelaTitulo>
                <TabelaTitulo numerico>Tempo activo</TabelaTitulo>
                <TabelaTitulo>Quando</TabelaTitulo>
              </TabelaLinha>
            </TabelaCabecalho>
            <TabelaCorpo>
              {(sessoes.dados ?? []).map((s) => (
                <TabelaLinha key={s.id}>
                  <TabelaCelula className="font-medium">{s.utilizador_nome || s.utilizador_email}</TabelaCelula>
                  <TabelaCelula>
                    {s.versao < 2 ? (
                      <span className="text-tinta-suave">{s.exercicio_id} (versão antiga)</span>
                    ) : (
                      nomeDoExercicio(s.exercicio_id)
                    )}
                  </TabelaCelula>
                  <TabelaCelula>{s.versao < 2 ? "—" : nomeDoOlho(s.olho)}</TabelaCelula>
                  <TabelaCelula>
                    <span className="flex flex-wrap items-center gap-2">
                      <Resultado s={s} />
                      {s.baixa_atencao && <Estado tom="aviso">Baixa atenção</Estado>}
                    </span>
                  </TabelaCelula>
                  <TabelaCelula numerico>
                    {minutosESegundos(s.segundos_activos ?? s.duracao_segundos)}
                  </TabelaCelula>
                  <TabelaCelula className="whitespace-nowrap text-tinta-suave">{formatarDataHora(s.created_at)}</TabelaCelula>
                </TabelaLinha>
              ))}
              {sessoes.dados?.length === 0 && (
                <TabelaLinha>
                  <TabelaCelula colSpan={6} className="py-8 text-center text-tinta-suave">
                    Sem sessões de exercício nos últimos {dias} dias.
                  </TabelaCelula>
                </TabelaLinha>
              )}
            </TabelaCorpo>
          </Tabela>
        </EstadoDadosAdmin>
      ) : (
        <EstadoDadosAdmin
          aCarregar={ativos.aCarregar}
          erro={ativos.erro}
          aoTentarDeNovo={() => void ativos.recarregar()}
          temDados={!!ativos.dados}
        >
          <p className="mb-2 text-legenda text-tinta-suave">Fizeram pelo menos um exercício nos últimos {dias} dias.</p>
          <Tabela legenda="Utilizadores activos">
            <TabelaCabecalho>
              <TabelaLinha>
                <TabelaTitulo>Utilizador</TabelaTitulo>
                <TabelaTitulo numerico>Sessões no período</TabelaTitulo>
                <TabelaTitulo>Última sessão</TabelaTitulo>
              </TabelaLinha>
            </TabelaCabecalho>
            <TabelaCorpo>
              {(ativos.dados ?? []).map((a) => (
                <TabelaLinha key={a.user_id}>
                  <TabelaCelula className="font-medium">{a.utilizador_nome || a.utilizador_email}</TabelaCelula>
                  <TabelaCelula numerico>{a.sessoes_no_periodo}</TabelaCelula>
                  <TabelaCelula className="whitespace-nowrap text-tinta-suave">
                    {formatarDataHora(a.ultima_sessao_em)}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
              {ativos.dados?.length === 0 && (
                <TabelaLinha>
                  <TabelaCelula colSpan={3} className="py-8 text-center text-tinta-suave">
                    Ninguém fez exercícios nos últimos {dias} dias.
                  </TabelaCelula>
                </TabelaLinha>
              )}
            </TabelaCorpo>
          </Tabela>
        </EstadoDadosAdmin>
      )}
    </>
  );
};

export default AdminAtividade;
