import { Coins, Gem } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PedidoLoja } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { formatarKz } from "@/pages/jogo/jogoConfig";

const COR_ESTADO: Record<PedidoLoja["estado"], string> = {
  pendente: "bg-gold/15 text-gold",
  aprovado: "bg-green/15 text-green",
  rejeitado: "bg-destructive/15 text-destructive",
};

const formatarNumero = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "Os meus pedidos" pagos em Kwanzas -- diamantes e moedas, com o estado. */
const PedidosLojaLista = ({ pedidos }: { pedidos: PedidoLoja[] }) => {
  const { t } = useTranslation();
  if (!pedidos.length) return null;
  return (
    <section className="mt-10 space-y-3" aria-labelledby="meus-pedidos">
      <h2 id="meus-pedidos" className="text-lg font-bold text-foreground">
        {t("LojaJogo.osMeusPedidos")}
      </h2>
      <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60">
        {pedidos.map((pedido) => {
          const Icone = pedido.tipo_item === "moedas" ? Coins : Gem;
          return (
            <li
              key={pedido.id}
              data-testid={`pedido-${pedido.id}`}
              className="flex items-center justify-between gap-3 p-4 text-sm"
            >
              <span className="flex items-center gap-2 text-foreground flex-wrap">
                <Icone className={cn("w-4 h-4", pedido.tipo_item === "moedas" ? "text-gold" : "text-teal")} />
                {t(`LojaJogo.quantidade.${pedido.tipo_item}`, { quantidade: formatarNumero(pedido.quantidade) })} ·{" "}
                {formatarKz(pedido.preco_kz)}
                <span className="text-muted-foreground">{new Date(pedido.created_at).toLocaleDateString()}</span>
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", COR_ESTADO[pedido.estado])}>
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
