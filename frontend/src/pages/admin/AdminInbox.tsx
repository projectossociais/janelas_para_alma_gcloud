import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { contactMessagesApi, mensagemDeErroApi, type ContactMessageAdmin } from "@/lib/apiClient";
import { toast } from "sonner";
import { Check, Mail, Phone } from "lucide-react";

type PremiumRow = {
  id: string;
  name: string;
  status: string;
  email: string;
  phone: string;
  for_whom?: string | null;
  diagnosis?: string | null;
  created_at: string;
};

const AdminInbox = () => {
  const [msgs, setMsgs] = useState<ContactMessageAdmin[]>([]);
  // Pedidos Premium ainda vêm do Supabase — a activação do Premium (W-11)
  // toca paywall e papéis, trabalho que exige revisão humana; até lá, este
  // separador fica como estava.
  const [premium, setPremium] = useState<PremiumRow[]>([]);

  const carregarMensagens = async () => {
    try {
      setMsgs(await contactMessagesApi.listar());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar as mensagens."));
    }
  };

  const carregarPremium = async () => {
    const { data } = await supabase
      .from("premium_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setPremium((data ?? []) as unknown as PremiumRow[]);
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

  const marcarPremiumContactado = async (id: string) => {
    const { error } = await supabase
      .from("premium_requests")
      .update({ status: "contacted" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Marcado como contactado.");
      carregarPremium();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensagens & Pedidos</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="messages">
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
                        <span className="font-semibold">{p.name}</span>
                        <Badge
                          variant={p.status === "pending" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {p.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {p.email}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {p.phone}
                        </span>
                      </div>
                      <div className="text-sm mt-2">
                        <span className="text-muted-foreground">Para: </span>
                        {p.for_whom || "—"} ·{" "}
                        <span className="text-muted-foreground">Diagnóstico: </span>
                        {p.diagnosis || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(p.created_at).toLocaleString("pt-PT")}
                      </div>
                    </div>
                    {p.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => marcarPremiumContactado(p.id)}
                      >
                        <Check className="w-3 h-3" /> Contactado
                      </Button>
                    )}
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
