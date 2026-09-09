import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Block {
  key: string;
  label: string;
  fields: { name: string; label: string; type: "text" | "textarea" | "image" }[];
}

const BLOCKS: Block[] = [
  { key: "hero", label: "Hero (topo da home)", fields: [
    { name: "title", label: "Título", type: "text" },
    { name: "subtitle", label: "Subtítulo", type: "textarea" },
    { name: "cta_label", label: "Texto do botão", type: "text" },
    { name: "cta_link", label: "Link do botão", type: "text" },
  ]},
  { key: "mission", label: "Missão", fields: [
    { name: "title", label: "Título", type: "text" },
    { name: "body", label: "Texto", type: "textarea" },
  ]},
  { key: "impact", label: "Impacto (números)", fields: [
    { name: "consultas", label: "Consultas realizadas", type: "text" },
    { name: "escolas", label: "Escolas visitadas", type: "text" },
    { name: "kambas", label: "Kambas voluntários", type: "text" },
  ]},
  { key: "contacts", label: "Contactos & redes sociais", fields: [
    { name: "email", label: "Email", type: "text" },
    { name: "whatsapp", label: "WhatsApp", type: "text" },
    { name: "instagram", label: "Instagram", type: "text" },
    { name: "facebook", label: "Facebook", type: "text" },
  ]},
];

const AdminContent = () => {
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});

  const load = async () => {
    const { data } = await supabase.from("site_content").select("*");
    const map: Record<string, Record<string, string>> = {};
    (data ?? []).forEach((r: any) => { map[r.key] = r.value || {}; });
    setValues(map);
  };
  useEffect(() => { load(); }, []);

  const save = async (key: string) => {
    const value = values[key] || {};
    const { error } = await supabase.from("site_content").upsert({ key, value });
    if (error) toast.error(error.message);
    else toast.success("Bloco guardado.");
  };

  const setField = (key: string, name: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [name]: v } }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Conteúdo do site</h2>
        <p className="text-sm text-muted-foreground">
          Edite textos e informações apresentadas nas páginas públicas. As alterações são publicadas ao guardar.
        </p>
      </div>

      {BLOCKS.map((block) => (
        <Card key={block.key}>
          <CardHeader><CardTitle>{block.label}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {block.fields.map((f) => {
              const val = values[block.key]?.[f.name] || "";
              return (
                <div key={f.name}>
                  <Label>{f.label}</Label>
                  {f.type === "textarea" ? (
                    <Textarea value={val} onChange={(e) => setField(block.key, f.name, e.target.value)} />
                  ) : (
                    <Input value={val} onChange={(e) => setField(block.key, f.name, e.target.value)} />
                  )}
                </div>
              );
            })}
            <Button onClick={() => save(block.key)}><Save className="w-4 h-4" /> Guardar</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminContent;
