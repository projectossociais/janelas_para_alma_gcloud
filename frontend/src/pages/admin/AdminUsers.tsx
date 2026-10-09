import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { EstadoDadosAdmin } from "@/components/admin/DadosAdmin";
import { useDadosAdmin } from "@/components/admin/useDadosAdmin";
import { ROLE_LABEL, type UserRole } from "@/contexts/AuthContext";
import { Campo } from "@/design/componentes/Campo";
import { Seleccao } from "@/design/componentes/Seleccao";
import {
  Estado,
  Tabela,
  TabelaCabecalho,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
  TabelaTitulo,
} from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import { formatarData } from "@/i18n/formatar";
import { adminApi, mensagemDeErroApi } from "@/lib/apiClient";

// "admin" fica de fora do selector genérico de propósito -- essa transição
// tem o seu próprio fluxo em Administradores (com protecção contra ficar
// sem nenhum admin), que este endpoint recusa (422) para nunca duplicar.
const PAPEIS_ATRIBUIVEIS: Exclude<UserRole, "admin">[] = [
  "comum",
  "estrabico",
  "profissional",
  "oftalmologista",
  "voluntario",
];

const AdminUsers = () => {
  const [searchParams] = useSearchParams();
  // Vem do cartão "Novos utilizadores" da visão geral: a mesma janela de dias.
  const dias = searchParams.get("dias") ? Number(searchParams.get("dias")) : undefined;
  const { dados, erro, aCarregar, recarregar } = useDadosAdmin(
    () => adminApi.listarUtilizadores(undefined, dias),
    "Não foi possível carregar os utilizadores.",
    [dias],
  );
  const [q, setQ] = useState("");
  const [aGuardar, setAGuardar] = useState<string | null>(null);

  const mudarPapel = async (userId: string, novoPapel: string) => {
    setAGuardar(userId);
    try {
      await adminApi.definirPapel(userId, novoPapel);
      toast.success("Perfil actualizado.");
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível actualizar o perfil."));
    } finally {
      setAGuardar(null);
    }
  };

  const linhas = (dados ?? []).filter((r) => {
    const s = q.toLowerCase();
    return !s || r.nome_completo?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s);
  });

  return (
    <>
      <CabecalhoConsola
        titulo="Utilizadores"
        descricao={
          dias ? (
            <>
              Registados nos últimos {dias} dias ·{" "}
              <Link to="/admin/utilizadores" className="text-accao underline underline-offset-2">
                ver todos
              </Link>
            </>
          ) : (
            "Todas as contas registadas."
          )
        }
      />

      <Campo
        rotulo="Pesquisar"
        type="search"
        placeholder="Nome ou email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sufixo={<Search className="size-4 text-tinta-suave" aria-hidden />}
        className="mb-4 max-w-sm"
      />

      <EstadoDadosAdmin aCarregar={aCarregar} erro={erro} aoTentarDeNovo={() => void recarregar()} temDados={!!dados}>
        <p className="mb-2 text-legenda text-tinta-suave" aria-live="polite">
          {linhas.length === 1 ? "1 utilizador" : `${linhas.length} utilizadores`}
          {q && dados ? ` de ${dados.length}` : ""}
        </p>
        <Tabela legenda="Utilizadores" className="min-w-[48rem]">
          <TabelaCabecalho>
            <TabelaLinha>
              <TabelaTitulo>Nome</TabelaTitulo>
              <TabelaTitulo>Email</TabelaTitulo>
              <TabelaTitulo>Perfil</TabelaTitulo>
              <TabelaTitulo>Premium</TabelaTitulo>
              <TabelaTitulo>Registado em</TabelaTitulo>
            </TabelaLinha>
          </TabelaCabecalho>
          <TabelaCorpo>
            {linhas.map((u) => (
              <TabelaLinha key={u.id}>
                <TabelaCelula className="font-medium">{u.nome_completo || "—"}</TabelaCelula>
                <TabelaCelula>{u.email}</TabelaCelula>
                <TabelaCelula>
                  {u.papel === "admin" ? (
                    <span className="flex flex-col gap-1">
                      <Estado tom="info">{ROLE_LABEL.admin}</Estado>
                      <span className="text-legenda text-tinta-suave">
                        Gerido em{" "}
                        <Link to="/admin/administradores" className="text-accao underline underline-offset-2">
                          Administradores
                        </Link>
                      </span>
                    </span>
                  ) : (
                    <Seleccao
                      rotulo={`Perfil de ${u.nome_completo || u.email}`}
                      rotuloOculto
                      tamanho="compacto"
                      marcador="Escolher…"
                      value={u.papel}
                      disabled={aGuardar === u.id}
                      onChange={(e) => void mudarPapel(u.id, e.target.value)}
                      opcoes={PAPEIS_ATRIBUIVEIS.map((r) => ({ valor: r, rotulo: ROLE_LABEL[r] }))}
                      className="w-48"
                    />
                  )}
                </TabelaCelula>
                <TabelaCelula>
                  {u.premium_ativo ? <Estado tom="sucesso">Activo</Estado> : <span className="text-tinta-suave">—</span>}
                </TabelaCelula>
                <TabelaCelula className="whitespace-nowrap text-tinta-suave">{formatarData(u.criado_em)}</TabelaCelula>
              </TabelaLinha>
            ))}
            {!linhas.length && (
              <TabelaLinha>
                <TabelaCelula colSpan={5} className="py-8 text-center text-tinta-suave">
                  {q ? "Nenhum utilizador corresponde à pesquisa." : "Ainda não há utilizadores."}
                </TabelaCelula>
              </TabelaLinha>
            )}
          </TabelaCorpo>
        </Tabela>
      </EstadoDadosAdmin>
    </>
  );
};

export default AdminUsers;
