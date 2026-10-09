import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL, type UserRole } from "@/contexts/AuthContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo, CampoTexto } from "@/design/componentes/Campo";
import { OpcaoConfirmar } from "@/design/componentes/OpcaoConfirmar";
import { Seleccao } from "@/design/componentes/Seleccao";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import { notificacoesApi, mensagemDeErroApi, PAPEIS_PARA_NOTIFICAR } from "@/lib/apiClient";

const FORM_VAZIO = { titulo: "", mensagem: "", papel: "all", enviarEmail: false };

interface UltimoEnvio {
  titulo: string;
  enviadas: number;
  papel: string;
  enviarEmail: boolean;
  emailsEnviados: number;
  emailsFalharam: number;
}

const pessoas = (n: number) => `${n} pessoa${n === 1 ? "" : "s"}`;

const AdminNotifications = () => {
  const [form, setForm] = useState(FORM_VAZIO);
  const [aEnviar, setAEnviar] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<UltimoEnvio | null>(null);

  const erroTitulo = tentou && !form.titulo.trim() ? "Escreva um título." : undefined;
  const erroMensagem = tentou && !form.mensagem.trim() ? "Escreva a mensagem." : undefined;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    setErroEnvio(null);
    if (!form.titulo.trim() || !form.mensagem.trim()) return;
    setAEnviar(true);
    try {
      const { enviadas, emails_enviados, emails_falharam } = await notificacoesApi.enviar(
        form.titulo,
        form.mensagem,
        form.papel === "all" ? null : form.papel,
        form.enviarEmail,
      );
      if (enviadas === 0) {
        toast.success("Enviada, mas não há ninguém com esse perfil ainda.");
      } else if (form.enviarEmail && emails_falharam > 0) {
        // Nunca esconder uma falha parcial atrás de um "sucesso" genérico
        // (CLAUDE.md §6): as notificações no sino foram todas criadas, mas
        // o admin precisa de saber que nem todos os emails saíram.
        toast.error(
          `Notificação enviada a ${pessoas(enviadas)}, mas ${emails_falharam} email${emails_falharam === 1 ? "" : "s"} falharam.`,
        );
      } else {
        toast.success(
          form.enviarEmail
            ? `Notificação enviada a ${pessoas(enviadas)}, com email para todos.`
            : `Notificação enviada a ${pessoas(enviadas)}.`,
        );
      }
      setUltimoEnvio({
        titulo: form.titulo,
        enviadas,
        papel: form.papel,
        enviarEmail: form.enviarEmail,
        emailsEnviados: emails_enviados,
        emailsFalharam: emails_falharam,
      });
      setForm(FORM_VAZIO);
      setTentou(false);
    } catch (err) {
      // Nada foi enviado: o erro fica escrito no formulário, com o que se escreveu intacto.
      setErroEnvio(mensagemDeErroApi(err, "Não foi possível enviar a notificação."));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <>
      <CabecalhoConsola
        titulo="Notificações"
        descricao="Cria uma notificação real na conta de cada destinatário: aparece no sino do site, não só aqui."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,36rem)_1fr]">
        <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-5 rounded-cartao border border-linha bg-superficie p-5">
          <h2 className="text-titulo-p text-tinta">Enviar notificação</h2>
          <Seleccao
            rotulo="Destinatários"
            marcador="Escolher…"
            value={form.papel}
            onChange={(e) => setForm({ ...form, papel: e.target.value })}
            opcoes={[
              { valor: "all", rotulo: "Todos" },
              ...PAPEIS_PARA_NOTIFICAR.map((p) => ({ valor: p, rotulo: ROLE_LABEL[p as UserRole] ?? p })),
            ]}
          />
          <Campo
            rotulo="Título"
            value={form.titulo}
            erro={erroTitulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />
          <CampoTexto
            rotulo="Mensagem"
            value={form.mensagem}
            erro={erroMensagem}
            onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
          />
          <OpcaoConfirmar
            rotulo="Enviar também por email"
            marcada={form.enviarEmail}
            aoMudar={(v) => setForm({ ...form, enviarEmail: v })}
          />
          {erroEnvio && (
            <Aviso variante="erro" anunciar titulo="A notificação não foi enviada">
              {erroEnvio}
            </Aviso>
          )}
          <Botao type="submit" aCarregar={aEnviar}>
            <Send aria-hidden /> Enviar
          </Botao>
        </form>

        {ultimoEnvio && (
          <section aria-labelledby="notificacoes-ultimo" className="self-start rounded-cartao border border-linha bg-superficie p-5">
            <h2 id="notificacoes-ultimo" className="text-titulo-p text-tinta">
              Último envio
            </h2>
            <p className="mt-3 text-corpo font-medium text-tinta">{ultimoEnvio.titulo}</p>
            <p className="mt-1 text-legenda text-tinta-suave">
              {ultimoEnvio.papel === "all"
                ? "Todos"
                : `Perfil: ${ROLE_LABEL[ultimoEnvio.papel as UserRole] ?? ultimoEnvio.papel}`}{" "}
              · {ultimoEnvio.enviadas} destinatário{ultimoEnvio.enviadas === 1 ? "" : "s"}
            </p>
            {ultimoEnvio.enviarEmail && (
              <p className={ultimoEnvio.emailsFalharam > 0 ? "mt-1 text-legenda font-medium text-erro" : "mt-1 text-legenda text-tinta-suave"}>
                Email: {ultimoEnvio.emailsEnviados} enviado{ultimoEnvio.emailsEnviados === 1 ? "" : "s"}
                {ultimoEnvio.emailsFalharam > 0 &&
                  `, ${ultimoEnvio.emailsFalharam} ${ultimoEnvio.emailsFalharam === 1 ? "falhou" : "falharam"}`}
              </p>
            )}
          </section>
        )}
      </div>
    </>
  );
};

export default AdminNotifications;
