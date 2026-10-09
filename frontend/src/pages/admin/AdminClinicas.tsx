import { useState } from "react";
import { ConfirmarAccao } from "@/components/admin/ConfirmarAccao";
import { EstadoDadosAdmin, useDadosAdmin } from "@/components/admin/DadosAdmin";
import { Botao } from "@/design/componentes/Botao";
import { Campo } from "@/design/componentes/Campo";
import { OpcaoConfirmar } from "@/design/componentes/OpcaoConfirmar";
import { Estado } from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import {
  clinicasApi,
  mensagemDeErroApi,
  type ClinicaParceiraAdmin,
  type MembroEquipaPublico,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";

const MODALIDADES = [
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "online", rotulo: "Teleconsulta" },
] as const;

interface DadosClinicas {
  clinicas: ClinicaParceiraAdmin[];
  equipas: Record<string, MembroEquipaPublico[]>;
}

const AdminClinicas = () => {
  const [formularios, setFormularios] = useState<Record<string, {
    especialidades: string;
    cidade: string;
    modalidades: string[];
    preco: string;
  }>>({});
  const [novoEmail, setNovoEmail] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { dados, erro, aCarregar, recarregar: carregar } = useDadosAdmin<DadosClinicas>(
    async () => {
      const lista = await clinicasApi.listarAdmin();
      const listasEquipa = await Promise.all(lista.map((c) => clinicasApi.listarEquipa(c.id)));
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
      return { clinicas: lista, equipas: Object.fromEntries(lista.map((c, i) => [c.id, listasEquipa[i]])) };
    },
    "Não foi possível carregar as clínicas.",
    [],
  );
  const clinicas = dados?.clinicas ?? [];
  const equipas = dados?.equipas ?? {};

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

  const mudarCampo = (clinicaId: string, campo: "especialidades" | "cidade" | "preco", valor: string) =>
    setFormularios((prev) => ({ ...prev, [clinicaId]: { ...prev[clinicaId], [campo]: valor } }));

  return (
    <>
      <CabecalhoConsola
        titulo="Clínicas parceiras"
        descricao="Perfil de cada clínica parceira e quem tem acesso ao portal próprio."
      />

      <EstadoDadosAdmin aCarregar={aCarregar} erro={erro} aoTentarDeNovo={() => void carregar()} temDados={!!dados}>
        <div className="space-y-6">
          {clinicas.map((clinica) => {
            const form = formularios[clinica.id];
            if (!form) return null;
            const equipa = equipas[clinica.id] || [];
            return (
              <section
                key={clinica.id}
                aria-labelledby={`clinica-${clinica.id}`}
                className="rounded-cartao border border-linha bg-superficie p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`clinica-${clinica.id}`} className="text-titulo-p text-tinta">
                    {clinica.nome}
                  </h2>
                  <Estado tom={clinica.ativa ? "sucesso" : "neutro"}>{clinica.ativa ? "Activa" : "Inactiva"}</Estado>
                </div>
                <p className="mt-1 text-legenda text-tinta-suave">
                  {clinica.email_contacto} · {clinica.telefone_contacto}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Campo
                    rotulo="Especialidades"
                    ajuda="Separadas por vírgula."
                    value={form.especialidades}
                    onChange={(e) => mudarCampo(clinica.id, "especialidades", e.target.value)}
                  />
                  <Campo rotulo="Cidade" value={form.cidade} onChange={(e) => mudarCampo(clinica.id, "cidade", e.target.value)} />
                  <Campo
                    rotulo="Preço indicativo"
                    placeholder="ex.: a partir de 15.000 Kz"
                    value={form.preco}
                    onChange={(e) => mudarCampo(clinica.id, "preco", e.target.value)}
                  />
                  <fieldset>
                    <legend className="mb-2 text-corpo font-medium text-tinta">Modalidades</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {MODALIDADES.map((m) => (
                        <OpcaoConfirmar
                          key={m.valor}
                          rotulo={m.rotulo}
                          marcada={form.modalidades.includes(m.valor)}
                          aoMudar={(marcada) =>
                            setFormularios((prev) => {
                              const atuais = prev[clinica.id].modalidades;
                              const novas = marcada ? [...atuais, m.valor] : atuais.filter((x) => x !== m.valor);
                              return { ...prev, [clinica.id]: { ...prev[clinica.id], modalidades: novas } };
                            })
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                </div>
                <Botao className="mt-4" aCarregar={ocupado === clinica.id} onClick={() => void guardarPerfil(clinica.id)}>
                  Guardar perfil
                </Botao>

                <div className="mt-6 border-t border-linha pt-5">
                  <h3 className="text-corpo font-medium text-tinta">Equipa com acesso ao portal</h3>
                  {equipa.length ? (
                    <ul className="mt-2 divide-y divide-linha rounded-controlo border border-linha">
                      {equipa.map((membro) => (
                        <li key={membro.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{membro.utilizador_nome || membro.utilizador_email}</span>
                            <span className="block truncate text-legenda text-tinta-suave">{membro.utilizador_email}</span>
                          </span>
                          <ConfirmarAccao
                            soIcone
                            icone={<Trash2 aria-hidden />}
                            rotulo={`Tirar ${membro.utilizador_email} da equipa de ${clinica.nome}`}
                            titulo="Tirar o acesso ao portal?"
                            descricao={`${membro.utilizador_email} deixa de entrar no portal de ${clinica.nome}. A conta continua a existir.`}
                            confirmar="Tirar acesso"
                            desactivado={ocupado === clinica.id}
                            aoConfirmar={() => void removerMembro(clinica.id, membro.utilizador_id)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-legenda text-tinta-suave">Ainda sem ninguém ligado a esta clínica.</p>
                  )}
                  <form
                    className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void adicionarMembro(clinica.id);
                    }}
                  >
                    <Campo
                      rotulo="Ligar uma conta"
                      ajuda="A conta tem de já existir (a pessoa regista-se primeiro); isto só a liga a esta clínica."
                      type="email"
                      placeholder="email@daclinica.com"
                      value={novoEmail[clinica.id] || ""}
                      onChange={(e) => setNovoEmail((prev) => ({ ...prev, [clinica.id]: e.target.value }))}
                      className="flex-1"
                    />
                    <Botao type="submit" variante="secundario" disabled={ocupado === clinica.id}>
                      <UserPlus aria-hidden /> Ligar conta
                    </Botao>
                  </form>
                </div>
              </section>
            );
          })}
          {dados && !clinicas.length && <p className="text-corpo text-tinta-suave">Nenhuma clínica registada.</p>}
        </div>
      </EstadoDadosAdmin>
    </>
  );
};

export default AdminClinicas;
