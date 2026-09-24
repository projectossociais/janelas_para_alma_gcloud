import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  clinicasApi,
  mensagemDeErroApi,
  type ClinicaParceiraAdmin,
  type MembroEquipaPublico,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";

const MODALIDADES = ["presencial", "online"] as const;

const AdminClinicas = () => {
  const [clinicas, setClinicas] = useState<ClinicaParceiraAdmin[]>([]);
  const [equipas, setEquipas] = useState<Record<string, MembroEquipaPublico[]>>({});
  const [formularios, setFormularios] = useState<Record<string, {
    especialidades: string;
    cidade: string;
    modalidades: string[];
    preco: string;
  }>>({});
  const [novoEmail, setNovoEmail] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const lista = await clinicasApi.listarAdmin();
      setClinicas(lista);
      setFormularios(
        Object.fromEntries(
          lista.map((c) => [
            c.id,
            {
              especialidades: c.especialidades.join(", "),
              cidade: c.cidade || "",
              modalidades: c.modalidades_suportadas,
              preco: c.preco_indicativo || "",
            },
          ]),
        ),
      );
      const listasEquipa = await Promise.all(lista.map((c) => clinicasApi.listarEquipa(c.id)));
      setEquipas(Object.fromEntries(lista.map((c, i) => [c.id, listasEquipa[i]])));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar as clínicas."));
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const guardarPerfil = async (clinicaId: string) => {
    const form = formularios[clinicaId];
    setOcupado(clinicaId);
    try {
      await clinicasApi.atualizarPerfil(clinicaId, {
        especialidades: form.especialidades.split(",").map((s) => s.trim()).filter(Boolean),
        cidade: form.cidade || null,
        modalidades_suportadas: form.modalidades as ("presencial" | "online")[],
        preco_indicativo: form.preco || null,
      });
      toast.success("Perfil da clínica actualizado.");
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível guardar o perfil."));
    } finally {
      setOcupado(null);
    }
  };

  const adicionarMembro = async (clinicaId: string) => {
    const email = (novoEmail[clinicaId] || "").trim();
    if (!email) return;
    setOcupado(clinicaId);
    try {
      await clinicasApi.adicionarEquipa(clinicaId, email);
      toast.success("Conta ligada à clínica. Já pode entrar no portal próprio.");
      setNovoEmail((prev) => ({ ...prev, [clinicaId]: "" }));
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível ligar esta conta."));
    } finally {
      setOcupado(null);
    }
  };

  const removerMembro = async (clinicaId: string, utilizadorId: string) => {
    setOcupado(clinicaId);
    try {
      await clinicasApi.removerEquipa(clinicaId, utilizadorId);
      toast.success("Ligação removida.");
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover esta ligação."));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Clínicas parceiras</h2>
        <p className="text-sm text-muted-foreground">
          Perfil de cada clínica e quem tem acesso ao portal próprio (Sprint 4, Fase 1 do matchmaker clínico).
        </p>
      </div>

      {clinicas.map((clinica) => {
        const form = formularios[clinica.id];
        if (!form) return null;
        return (
          <Card key={clinica.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                {clinica.nome}
                <Badge variant={clinica.ativa ? "default" : "outline"}>{clinica.ativa ? "activa" : "inactiva"}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{clinica.email_contacto} · {clinica.telefone_contacto}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`especialidades-${clinica.id}`}>Especialidades (separadas por vírgula)</Label>
                  <Input
                    id={`especialidades-${clinica.id}`}
                    value={form.especialidades}
                    onChange={(e) =>
                      setFormularios((prev) => ({
                        ...prev,
                        [clinica.id]: { ...prev[clinica.id], especialidades: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`cidade-${clinica.id}`}>Cidade</Label>
                  <Input
                    id={`cidade-${clinica.id}`}
                    value={form.cidade}
                    onChange={(e) =>
                      setFormularios((prev) => ({ ...prev, [clinica.id]: { ...prev[clinica.id], cidade: e.target.value } }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`preco-${clinica.id}`}>Preço indicativo</Label>
                  <Input
                    id={`preco-${clinica.id}`}
                    value={form.preco}
                    placeholder="ex.: a partir de 15.000 Kz"
                    onChange={(e) =>
                      setFormularios((prev) => ({ ...prev, [clinica.id]: { ...prev[clinica.id], preco: e.target.value } }))
                    }
                  />
                </div>
                <div>
                  <Label>Modalidades suportadas</Label>
                  <div className="flex gap-4 mt-2">
                    {MODALIDADES.map((m) => (
                      <label key={m} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.modalidades.includes(m)}
                          onCheckedChange={(checked) =>
                            setFormularios((prev) => {
                              const atuais = prev[clinica.id].modalidades;
                              const novas = checked === true ? [...atuais, m] : atuais.filter((x) => x !== m);
                              return { ...prev, [clinica.id]: { ...prev[clinica.id], modalidades: novas } };
                            })
                          }
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <Button size="sm" disabled={ocupado === clinica.id} onClick={() => guardarPerfil(clinica.id)}>
                Guardar perfil
              </Button>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-2">Equipa com acesso ao portal</h4>
                <div className="space-y-2 mb-3">
                  {(equipas[clinica.id] || []).map((membro) => (
                    <div key={membro.id} className="flex items-center justify-between border rounded-lg p-2 gap-2">
                      <div className="text-sm">
                        <span className="font-medium">{membro.utilizador_nome || membro.utilizador_email}</span>
                        <span className="text-xs text-muted-foreground ml-2">{membro.utilizador_email}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={ocupado === clinica.id}
                        onClick={() => removerMembro(clinica.id, membro.utilizador_id)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {!(equipas[clinica.id] || []).length && (
                    <p className="text-xs text-muted-foreground">Ainda sem ninguém ligado a esta clínica.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@daclinica.com"
                    value={novoEmail[clinica.id] || ""}
                    onChange={(e) => setNovoEmail((prev) => ({ ...prev, [clinica.id]: e.target.value }))}
                  />
                  <Button size="sm" disabled={ocupado === clinica.id} onClick={() => adicionarMembro(clinica.id)}>
                    <UserPlus className="w-3 h-3" /> Ligar conta
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  A conta tem de já existir (a pessoa regista-se normalmente primeiro) — isto só liga-a a esta clínica.
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {!clinicas.length && <p className="text-center text-muted-foreground py-6">Nenhuma clínica registada.</p>}
    </div>
  );
};

export default AdminClinicas;
