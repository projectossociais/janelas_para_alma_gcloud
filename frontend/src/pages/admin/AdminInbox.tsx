import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  contactMessagesApi,
  premiumApi,
  mensagemDeErroApi,
  type ContactMessageAdmin,
  type PedidoPremiumAdmin,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Check, FileText, Mail, Phone, X } from "lucide-react";

const AdminInbox = () => {
  // Permite a Central de Pendências (AdminOverview) linkar directamente ao
  // separador certo -- ex.: /admin/mensagens?tab=premium.
  const [searchParams] = useSearchParams();
  const tabInicial = searchParams.get("tab") === "premium" ? "premium" : "messages";
  const [msgs, setMsgs] = useState<ContactMessageAdmin[]>([]);
  const [premium, setPremium] = useState<PedidoPremiumAdmin[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregarMensagens = async () => {
    try {
      setMsgs(await contactMessagesApi.listar());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar as mensagens."));
    }
  };

  const carregarPremium = async () => {
    try {
      setPremium(await premiumApi.listar());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os pedidos Premium."));
    }
  };

  useEffect(() => {
    carregarMensagens();
    carregarPremium();
  }, []);

  const marcarMensagemLida = async (id: string) => {
    try {
      await contactMessagesApi.marcarLida(id);
      toast.success("Marcada como tratada.");
      await carregarMensagens();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível marcar a mensagem."));
    }
  };

  const aprovarPagamento = async (id: string) => {
    setOcupado(id);
    try {
      await premiumApi.aprovar(id);
      toast.success("Pagamento aprovado. Premium activo por 30 dias.");
      await carregarPremium();
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
      await carregarPremium();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível revogar o acesso."));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensagens & Pedidos</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tabInicial}>
          <TabsList>
            <TabsTrigger value="messages">Mensagens ({msgs.length})</TabsTrigger>
            <TabsTrigger value="premium">Pedidos Premium ({premium.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-3 mt-4">
            {msgs.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{m.nome}</span>
                        <Badge variant="outline" className="text-xs">contacto</Badge>
                        {m.lida && (
                          <Badge variant="secondary" className="text-xs">tratada</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {m.email}
                        </span>
                      </div>
                      {m.assunto && <div className="text-sm font-medium mt-2">{m.assunto}</div>}
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {m.mensagem}
                      </p>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(m.created_at).toLocaleString("pt-PT")}
                      </div>
                    </div>
                    {!m.lida && (
                      <Button size="sm" variant="outline" onClick={() => marcarMensagemLida(m.id)}>
                        <Check className="w-3 h-3" /> Marcar tratada
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!msgs.length && (
              <p className="text-center text-muted-foreground py-6">Sem mensagens.</p>
            )}
          </TabsContent>

          <TabsContent value="premium" className="space-y-3 mt-4">
            {premium.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.nome}</span>
                        <Badge
                          variant={
                            p.status === "aprovado"
                              ? "default"
                              : p.status === "revogado"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {p.status}
                        </Badge>
                        {!p.user_id && (
                          <Badge variant="outline" className="text-xs">sem conta ligada</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {p.email}
                        </span>
                        {p.telefone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {p.telefone}
                          </span>
                        )}
                      </div>
                      <div className="text-sm mt-2">
                        <span className="text-muted-foreground">Plano: </span>
                        {p.plano || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(p.created_at).toLocaleString("pt-PT")}
                        {p.aprovado_em &&
                          ` · decidido ${new Date(p.aprovado_em).toLocaleString("pt-PT")}`}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {p.comprovativo_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={p.comprovativo_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="w-3 h-3" /> Ver comprovativo
                          </a>
                        </Button>
                      )}
                      {p.status !== "aprovado" && (
                        <Button
                          size="sm"
                          onClick={() => aprovarPagamento(p.id)}
                          disabled={ocupado === p.id || !p.user_id}
                          title={!p.user_id ? "O pedido não está ligado a uma conta" : undefined}
                        >
                          <Check className="w-3 h-3" /> Aprovar pagamento
                        </Button>
                      )}
                      {p.status === "aprovado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revogarPremium(p.id)}
                          disabled={ocupado === p.id}
                        >
                          <X className="w-3 h-3" /> Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!premium.length && (
              <p className="text-center text-muted-foreground py-6">Sem pedidos.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminInbox;
