import { useState, type FormEvent } from "react";
import { ShieldPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarAccao } from "@/components/admin/ConfirmarAccao";
import { EstadoDadosAdmin, useDadosAdmin } from "@/components/admin/DadosAdmin";
import { Botao } from "@/design/componentes/Botao";
import { Campo } from "@/design/componentes/Campo";
import {
  Tabela,
  TabelaCabecalho,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
  TabelaTitulo,
} from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import { formatarData } from "@/i18n/formatar";
import { adminApi, mensagemDeErroApi, type AdminUtilizador } from "@/lib/apiClient";

// W-11: no modelo novo "admin" é binário (uma coluna `papel`), não uma
// matriz de permissões. O primeiro admin cria-se por linha de comando:
// `python -m app.criar_admin <email>`.

const AdminAdmins = () => {
  const { dados, erro, aCarregar, recarregar } = useDadosAdmin(
    () => adminApi.listarUtilizadores("admin"),
    "Não foi possível carregar os administradores.",
    [],
  );
  const [email, setEmail] = useState("");
  const [aAdicionar, setAAdicionar] = useState(false);
  const [aRemover, setARemover] = useState<string | null>(null);

  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = email.trim();
    if (!limpo) return;
    setAAdicionar(true);
    try {
      await adminApi.promover(limpo);
      toast.success("Admin adicionado.");
      setEmail("");
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível adicionar o administrador."));
    } finally {
      setAAdicionar(false);
    }
  };

  const remover = async (linha: AdminUtilizador) => {
    setARemover(linha.id);
    try {
      await adminApi.removerAdmin(linha.id);
      toast.success("Admin removido.");
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível remover o administrador."));
    } finally {
      setARemover(null);
    }
  };

  return (
    <>
      <CabecalhoConsola titulo="Administradores" descricao="Quem tem acesso a este painel." />

      <form
        onSubmit={(e) => void adicionar(e)}
        className="mb-8 flex max-w-xl flex-col gap-3 rounded-cartao border border-linha bg-superficie p-5 sm:flex-row sm:items-end"
      >
        <Campo
          rotulo="Adicionar administrador"
          ajuda="A conta tem de já existir."
          type="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={aAdicionar}
          className="flex-1"
        />
        <Botao type="submit" aCarregar={aAdicionar} disabled={!email.trim()}>
          <ShieldPlus aria-hidden />
          Adicionar
        </Botao>
      </form>

      <EstadoDadosAdmin aCarregar={aCarregar} erro={erro} aoTentarDeNovo={() => void recarregar()} temDados={!!dados}>
        <Tabela legenda="Administradores">
          <TabelaCabecalho>
            <TabelaLinha>
              <TabelaTitulo>Utilizador</TabelaTitulo>
              <TabelaTitulo>Conta criada em</TabelaTitulo>
              <TabelaTitulo>
                <span className="sr-only">Acções</span>
              </TabelaTitulo>
            </TabelaLinha>
          </TabelaCabecalho>
          <TabelaCorpo>
            {(dados ?? []).map((r) => (
              <TabelaLinha key={r.id}>
                <TabelaCelula>
                  <span className="block font-medium">{r.nome_completo || "—"}</span>
                  <span className="block text-legenda text-tinta-suave">{r.email}</span>
                </TabelaCelula>
                <TabelaCelula className="whitespace-nowrap text-tinta-suave">{formatarData(r.criado_em)}</TabelaCelula>
                <TabelaCelula className="text-right">
                  <ConfirmarAccao
                    soIcone
                    icone={<Trash2 aria-hidden />}
                    rotulo={`Remover ${r.email} dos administradores`}
                    titulo="Remover administrador?"
                    descricao={`${r.email} deixa de ter acesso a este painel. A conta continua a existir.`}
                    confirmar="Remover"
                    aCarregar={aRemover === r.id}
                    desactivado={aRemover !== null && aRemover !== r.id}
                    aoConfirmar={() => void remover(r)}
                  />
                </TabelaCelula>
              </TabelaLinha>
            ))}
            {dados?.length === 0 && (
              <TabelaLinha>
                <TabelaCelula colSpan={3} className="py-8 text-center text-tinta-suave">
                  Sem administradores.
                </TabelaCelula>
              </TabelaLinha>
            )}
          </TabelaCorpo>
        </Tabela>
      </EstadoDadosAdmin>
    </>
  );
};

export default AdminAdmins;
