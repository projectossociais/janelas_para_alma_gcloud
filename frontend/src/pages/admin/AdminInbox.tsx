import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Mail, Phone } from "lucide-react";

type ContactRow = {
  id: string;
  name: string;
  source: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
  message: string;
  created_at: string;
};

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
  const [msgs, setMsgs] = useState<ContactRow[]>([]);
  const [premium, setPremium] = useState<PremiumRow[]>([]);

  const load = async () => {
    const [m, p] = await Promise.all([
      supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("premium_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setMsgs((m.data ?? []) as unknown as ContactRow[]);
    setPremium((p.data ?? []) as unknown as PremiumRow[]);
  };
  useEffect(() => { load(); }, []);

  const markDone = async (table: "contact_messages" | "premium_requests", id: string) => {
    const status = table === "contact_messages" ? "handled" : "contacted";
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marcado como tratado."); load(); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Mensagens & Pedidos</CardTitle></CardHeader>
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
                        <span className="font-semibold">{m.name}</span>
                        <Badge variant="outline" className="text-xs">{m.source}</Badge>
                        {m.status !== "new" && <Badge variant="secondary" className="text-xs">{m.status}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                        {m.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</span>}
                        {m.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>}
                      </div>
                      {m.subject && <div className="text-sm font-medium mt-2">{m.subject}</div>}
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.message}</p>
                      <div className="text-xs text-muted-foreground mt-2">{new Date(m.created_at).toLocaleString("pt-PT")}</div>
                    </div>
                    {m.status === "new" && (
                      <Button size="sm" variant="outline" onClick={() => markDone("contact_messages", m.id)}>
                        <Check className="w-3 h-3" /> Marcar tratado
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!msgs.length && <p className="text-center text-muted-foreground py-6">Sem mensagens.</p>}
          </TabsContent>

          <TabsContent value="premium" className="space-y-3 mt-4">
            {premium.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.name}</span>
                        <Badge variant={p.status === "pending" ? "default" : "secondary"} className="text-xs">{p.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>
                      </div>
                      <div className="text-sm mt-2">
                        <span className="text-muted-foreground">Para: </span>{p.for_whom || "—"} · <span className="text-muted-foreground">Diagnóstico: </span>{p.diagnosis || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">{new Date(p.created_at).toLocaleString("pt-PT")}</div>
                    </div>
                    {p.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => markDone("premium_requests", p.id)}>
                        <Check className="w-3 h-3" /> Contactado
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!premium.length && <p className="text-center text-muted-foreground py-6">Sem pedidos.</p>}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminInbox;
