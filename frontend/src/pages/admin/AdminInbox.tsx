import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Coins, FileText, Gem, Mail, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarAccao } from "@/components/admin/ConfirmarAccao";
import { EstadoDadosAdmin } from "@/components/admin/DadosAdmin";
import { useDadosAdmin } from "@/components/admin/useDadosAdmin";
import { Botao } from "@/design/componentes/Botao";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { Estado } from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import { formatarDataHora } from "@/i18n/formatar";
import { contactMessagesApi, jogoApi, premiumApi, mensagemDeErroApi } from "@/lib/apiClient";
import { formatarKz } from "@/pages/jogo/jogoConfig";

// "diamantes" mantém-se como alias antigo do separador da loja do jogo.
const VISTAS_VALIDAS = ["messages", "premium", "loja", "diamantes"] as const;
type Vista = "messages" | "premium" | "loja";

const ESTADO_PREMIUM: Record<string, { rotulo: string; tom: "aviso" | "sucesso" | "erro" | "neutro" }> = {
  pendente: { rotulo: "Por decidir", tom: "aviso" },
  aprovado: { rotulo: "Aprovado", tom: "sucesso" },
  revogado: { rotulo: "Revogado", tom: "erro" },
};
const ESTADO_LOJA: Record<string, { rotulo: string; tom: "aviso" | "sucesso" | "erro" | "neutro" }> = {
  pendente: { rotulo: "Por decidir", tom: "aviso" },
  aprovado: { rotulo: "Creditado", tom: "sucesso" },
  rejeitado: { rotulo: "Rejeitado", tom: "erro" },
};
const EstadoDe = ({ mapa, estado }: { mapa: typeof ESTADO_PREMIUM; estado: string }) => {
  const e = mapa[estado] ?? { rotulo: estado, tom: "neutro" as const };
  return <Estado tom={e.tom}>{e.rotulo}</Estado>;
};

// Como nas lojas: o toLocaleString("pt-PT") escreve "9000" (só agrupa a partir de 5 algarismos).
const numero = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** "165 diamantes" / "9.000 moedas" -- e o particípio concorda ("creditadas" para moedas). */
const quantidadeLoja = (n: number, tipo: string) => `${numero(n)} ${tipo}`;
const creditados = (tipo: string) => (tipo === "moedas" ? "creditadas" : "creditados");

const Item = ({ children, accoes, testId }: { children: ReactNode; accoes?: ReactNode; testId?: string }) => (
  <li data-testid={testId} className="rounded-cartao border border-linha bg-superficie p-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">{children}</div>
      {accoes && <div className="flex shrink-0 flex-col gap-2 sm:items-end">{accoes}</div>}
    </div>
  </li>
);

const Contacto = ({ email, telefone }: { email: string; telefone?: string | null }) => (
  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-legenda text-tinta-suave">
    <a href={`mailto:${email}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
      <Mail className="size-3.5" aria-hidden />
      {email}
    </a>
    {telefone && (
      <a href={`tel:${telefone}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
        <Phone className="size-3.5" aria-hidden />
        {telefone}
      </a>
    )}
  </p>
);

const VerComprovativo = ({ url }: { url: string }) => (
  <Botao asChild variante="secundario">
    <a href={url} target="_blank" rel="noopener noreferrer">
      <FileText aria-hidden /> Ver comprovativo
    </a>
  </Botao>
);

const AdminInbox = () => {
  // A visão geral liga directamente à vista certa (ex.: ?tab=premium).
  const [searchParams, setSearchParams] = useSearchParams();
  const pedida = searchParams.get("tab");
  const valida = VISTAS_VALIDAS.includes(pedida as (typeof VISTAS_VALIDAS)[number]) ? pedida : "messages";
  const vista: Vista = valida === "diamantes" ? "loja" : (valida as Vista);
  const mudarVista = (v: Vista) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", v);
    setSearchParams(p, { replace: true });
  };

  const mensagens = useDadosAdmin(() => contactMessagesApi.listar(), "Não foi possível carregar as mensagens.", []);
  const premium = useDadosAdmin(() => premiumApi.listar(), "Não foi possível carregar os pedidos Premium.", []);
  const loja = useDadosAdmin(() => jogoApi.listarPedidosLoja(), "Não foi possível carregar os pedidos da loja do jogo.", []);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Aprovar = pagamento confirmado: a API credita os diamantes ou as moedas
  // do pedido uma única vez (um segundo clique ou outro admin recebe 409).
  const decidirPedidoLoja = async (id: string, decisao: "aprovar" | "rejeitar") => {
    setOcupado(id);
    try {
      if (decisao === "aprovar") {
        const pedido = await jogoApi.aprovarPedidoLoja(id);
        toast.success(`Pagamento confirmado. ${quantidadeLoja(pedido.quantidade, pedido.tipo_item)} ${creditados(pedido.tipo_item)}.`);
      } else {
        await jogoApi.rejeitarPedidoLoja(id);
        toast.success("Pedido rejeitado. Nada foi creditado.");
      }
      await loja.recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível decidir o pedido."));
    } finally {
      setOcupado(null);
    }
  };

  const marcarMensagemLida = async (id: string) => {
    setOcupado(id);
    try {
      await contactMessagesApi.marcarLida(id);
      toast.success("Marcada como tratada.");
      await mensagens.recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível marcar a mensagem."));
    } finally {
      setOcupado(null);
    }
  };

  const aprovarPagamento = async (id: string) => {
    setOcupado(id);
    try {
      await premiumApi.aprovar(id);
      toast.success("Pagamento aprovado. Premium activo por 30 dias.");
      await premium.recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível aprovar o pagamento."));
    } finally {
      setOcupado(null);
    }
  };

  const revogarPremium = async (id: string) => {
    setOcupado(id);
    try {
      await premiumApi.revogar(id);
      toast.success("Acesso Premium revogado.");
      await premium.recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível revogar o acesso."));
    } finally {
      setOcupado(null);
    }
  };

  // Entre parênteses, o que ainda pede trabalho -- o mesmo critério nas três.
  const porTratar = (n: number | undefined) => (n === undefined ? "" : ` (${n})`);
  const ocupadoOutro = (id: string) => ocupado !== null && ocupado !== id;

  return (
    <>
      <CabecalhoConsola titulo="Mensagens e pedidos" descricao="Entre parênteses, o que ainda está por tratar." />

      <GrupoEscolha<Vista>
        legenda="Mostrar"
        legendaOculta
        aparencia="pastilha"
        valor={vista}
        aoMudar={mudarVista}
        className="mb-5"
        opcoes={[
          { valor: "messages", rotulo: `Mensagens${porTratar(mensagens.dados?.filter((m) => !m.lida).length)}` },
          { valor: "premium", rotulo: `Pedidos Premium${porTratar(premium.dados?.filter((p) => p.status === "pendente").length)}` },
          { valor: "loja", rotulo: `Loja do jogo${porTratar(loja.dados?.filter((d) => d.estado === "pendente").length)}` },
        ]}
      />

      {vista === "messages" && (
        <EstadoDadosAdmin
          aCarregar={mensagens.aCarregar}
          erro={mensagens.erro}
          aoTentarDeNovo={() => void mensagens.recarregar()}
          temDados={!!mensagens.dados}
        >
          {mensagens.dados?.length ? (
            <ul className="space-y-3">
              {mensagens.dados.map((m) => (
                <Item
                  key={m.id}
                  accoes={
                    !m.lida && (
                      <Botao variante="secundario" aCarregar={ocupado === m.id} disabled={ocupadoOutro(m.id)} onClick={() => void marcarMensagemLida(m.id)}>
                        <Check aria-hidden /> Marcar tratada
                      </Botao>
                    )
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.nome}</span>
                    {m.lida ? <Estado>Tratada</Estado> : <Estado tom="aviso">Por ler</Estado>}
                  </div>
                  <Contacto email={m.email} />
                  {m.assunto && <p className="mt-2 font-medium">{m.assunto}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-tinta-suave">{m.mensagem}</p>
                  <p className="mt-2 text-legenda text-tinta-suave">{formatarDataHora(m.created_at)}</p>
                </Item>
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Sem mensagens.</p>
          )}
        </EstadoDadosAdmin>
      )}

      {vista === "premium" && (
        <EstadoDadosAdmin
          aCarregar={premium.aCarregar}
          erro={premium.erro}
          aoTentarDeNovo={() => void premium.recarregar()}
          temDados={!!premium.dados}
        >
          {premium.dados?.length ? (
            <ul className="space-y-3">
              {premium.dados.map((p) => (
                <Item
                  key={p.id}
                  accoes={
                    <>
                      {p.comprovativo_url && <VerComprovativo url={p.comprovativo_url} />}
                      {p.status !== "aprovado" && (
                        <ConfirmarAccao
                          tom="accao"
                          icone={<Check aria-hidden />}
                          rotulo="Aprovar pagamento"
                          titulo="Aprovar o pagamento?"
                          descricao={`Confirme que o pagamento de ${p.nome} chegou. O Premium fica activo por 30 dias.`}
                          confirmar="Aprovar"
                          aCarregar={ocupado === p.id}
                          desactivado={ocupadoOutro(p.id) || !p.user_id}
                          aoConfirmar={() => void aprovarPagamento(p.id)}
                        />
                      )}
                      {p.status === "aprovado" && (
                        <ConfirmarAccao
                          icone={<X aria-hidden />}
                          rotulo="Revogar"
                          titulo="Revogar o Premium?"
                          descricao={`${p.nome} perde já o acesso aos exercícios Premium.`}
                          confirmar="Revogar"
                          aCarregar={ocupado === p.id}
                          desactivado={ocupadoOutro(p.id)}
                          aoConfirmar={() => void revogarPremium(p.id)}
                        />
                      )}
                    </>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.nome}</span>
                    <EstadoDe mapa={ESTADO_PREMIUM} estado={p.status} />
                    {!p.user_id && <Estado>Sem conta ligada: não se pode aprovar</Estado>}
                  </div>
                  <Contacto email={p.email} telefone={p.telefone} />
                  <p className="mt-2">
                    <span className="text-tinta-suave">Plano: </span>
                    {p.plano || "—"}
                  </p>
                  <p className="mt-2 text-legenda text-tinta-suave">
                    Pedido em {formatarDataHora(p.created_at)}
                    {p.aprovado_em && ` · decidido em ${formatarDataHora(p.aprovado_em)}`}
                  </p>
                </Item>
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Sem pedidos.</p>
          )}
        </EstadoDadosAdmin>
      )}

      {vista === "loja" && (
        <EstadoDadosAdmin
          aCarregar={loja.aCarregar}
          erro={loja.erro}
          aoTentarDeNovo={() => void loja.recarregar()}
          temDados={!!loja.dados}
        >
          {loja.dados?.length ? (
            <ul className="space-y-3">
              {loja.dados.map((d) => (
                <Item
                  key={d.id}
                  testId={`pedido-loja-${d.id}`}
                  accoes={
                    <>
                      <VerComprovativo url={d.comprovativo_url} />
                      {d.estado === "pendente" && (
                        <>
                          <ConfirmarAccao
                            tom="accao"
                            icone={<Check aria-hidden />}
                            rotulo="Confirmar pagamento"
                            titulo="Confirmar o pagamento?"
                            descricao={`Confirme que os ${formatarKz(d.preco_kz)} chegaram. ${quantidadeLoja(d.quantidade, d.tipo_item)} são ${creditados(d.tipo_item)} nesta conta, uma única vez; não se pode desfazer.`}
                            confirmar="Confirmar e creditar"
                            aCarregar={ocupado === d.id}
                            desactivado={ocupadoOutro(d.id) || !d.utilizador_id}
                            aoConfirmar={() => void decidirPedidoLoja(d.id, "aprovar")}
                          />
                          <ConfirmarAccao
                            icone={<X aria-hidden />}
                            rotulo="Rejeitar"
                            titulo="Rejeitar o pedido?"
                            descricao="Nada é creditado. Use quando o pagamento não chegou ou o comprovativo não serve."
                            confirmar="Rejeitar"
                            desactivado={ocupado !== null}
                            aoConfirmar={() => void decidirPedidoLoja(d.id, "rejeitar")}
                          />
                        </>
                      )}
                    </>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {d.tipo_item === "moedas" ? (
                        <Coins className="size-4 text-aviso" aria-hidden />
                      ) : (
                        <Gem className="size-4 text-accao" aria-hidden />
                      )}
                      {quantidadeLoja(d.quantidade, d.tipo_item)} · {formatarKz(d.preco_kz)}
                    </span>
                    <EstadoDe mapa={ESTADO_LOJA} estado={d.estado} />
                    {!d.utilizador_id && <Estado>Conta apagada</Estado>}
                  </div>
                  <p className="mt-1 text-legenda text-tinta-suave">
                    Pacote {d.pacote_id} · conta {d.utilizador_id ?? "—"}
                  </p>
                  <p className="mt-2 text-legenda text-tinta-suave">
                    Pedido em {formatarDataHora(d.created_at)}
                    {d.decidido_em && ` · decidido em ${formatarDataHora(d.decidido_em)}`}
                  </p>
                </Item>
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Sem pedidos da loja do jogo.</p>
          )}
        </EstadoDadosAdmin>
      )}
    </>
  );
};

export default AdminInbox;
