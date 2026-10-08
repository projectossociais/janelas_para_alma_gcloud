import { Coins, Gem } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design/cn";
import { formatarData } from "@/i18n/formatar";
import type { PedidoLoja } from "@/lib/apiClient";
import { formatarKz } from "@/pages/jogo/jogoConfig";

const COR_ESTADO: Record<PedidoLoja["estado"], string> = {
  pendente: "bg-aviso-suave text-aviso",
  aprovado: "bg-sucesso-suave text-sucesso",
  rejeitado: "bg-erro-suave text-erro",
};

const formatarNumero = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "Os meus pedidos" pagos em Kwanzas -- diamantes e moedas, com o estado em texto. */
const PedidosLojaLista = ({ pedidos }: { pedidos: PedidoLoja[] }) => {
  const { t } = useTranslation();
  if (!pedidos.length) return null;
  return (
    <section className="mt-12" aria-labelledby="meus-pedidos">
      <h2 id="meus-pedidos" className="text-titulo-p text-tinta">
        {t("LojaJogo.osMeusPedidos")}
      </h2>
      <ul className="mt-4 divide-y divide-linha rounded-cartao border border-linha bg-superficie">
        {pedidos.map((pedido) => {
          const Icone = pedido.tipo_item === "moedas" ? Coins : Gem;
          return (
            <li
              key={pedido.id}
              data-testid={`pedido-${pedido.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-corpo"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-tinta">
                <Icone
                  className={cn("size-4", pedido.tipo_item === "moedas" ? "text-aviso" : "text-accao")}
                  aria-hidden
                />
                <span className="font-medium">
                  {t(`LojaJogo.quantidade.${pedido.tipo_item}`, { quantidade: formatarNumero(pedido.quantidade) })}
                </span>
                <span className="text-tinta-suave">
                  · {formatarKz(pedido.preco_kz)} · {formatarData(pedido.created_at)}
                </span>
              </span>
              <span className={cn("rounded-pilula px-2.5 py-0.5 text-legenda font-medium", COR_ESTADO[pedido.estado])}>
                {t(`LojaJogo.estados.${pedido.estado}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PedidosLojaLista;
