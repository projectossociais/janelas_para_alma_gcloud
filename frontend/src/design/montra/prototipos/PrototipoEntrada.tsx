import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { Campo } from "../../componentes/Campo";
import { CampoPassword } from "../../componentes/CampoPassword";
import { TransicaoPasso } from "../../componentes/Passos";
import { LayoutEntrada } from "../../layouts/LayoutEntrada";
import { Ligacao } from "../../Ligacao";
import { logo } from "./dados";
import googleG from "./google-g.svg";

/**
 * Arquétipo Entrada: uma só porta, email primeiro (docs/ESTRUTURA_SITE.md §4).
 * Se a conta existe, pede a password; se não, cria a conta com o email já
 * preenchido. Acaba com a pergunta "Entrar ou Registar?" antes de a pessoa
 * saber qual é o caso dela. Protótipo: emails com "ana" existem.
 */
type Estado = "email" | "password" | "criar";

const TEXTOS_PASSWORD = { mostrar: "Mostrar", esconder: "Esconder" };

export const PrototipoEntrada = () => {
  const [estado, setEstado] = useState<Estado>("email");
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | undefined>();

  const ir = (novo: Estado, d: 1 | -1) => {
    setDireccao(d);
    setEstado(novo);
  };

  const continuarEmail = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErro("Escreva o email completo, por exemplo nome@gmail.com.");
      return;
    }
    setErro(undefined);
    ir(email.includes("ana") ? "password" : "criar", 1);
  };

  return (
    <LayoutEntrada
      logotipo={logo("escuro")}
      inicio={{ href: "/_montra/prototipos/site", rotulo: "Janelas Para a Alma, início" }}
      voltar={{ href: "/_montra/prototipos/site", rotulo: "Voltar ao site" }}
      frase="Ver bem começa por saber."
      factos={[
        "Nenhuma fotografia é guardada.",
        "Só você vê os seus resultados.",
        "Clínica parceira real, em Luanda.",
      ]}
      textoSaltar="Saltar para o formulário"
    >
      <TransicaoPasso chave={estado} direccao={direccao}>
        {estado === "email" && (
          <form onSubmit={continuarEmail} noValidate>
            <h1 className="text-titulo-m text-tinta">Entrar ou criar conta</h1>
            <p className="mt-2 text-corpo text-tinta-suave">Guarde os resultados e acompanhe a evolução.</p>
            <Botao variante="secundario" larguraTotal className="mt-8">
              <img src={googleG} alt="" className="size-5" />
              Continuar com Google
            </Botao>
            <div className="my-6 flex items-center gap-4 text-legenda text-tinta-suave" aria-hidden>
              <span className="h-px flex-1 bg-linha" />
              ou
              <span className="h-px flex-1 bg-linha" />
            </div>
            <Campo
              rotulo="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              erro={erro}
            />
            <Botao type="submit" larguraTotal className="mt-6">
              Continuar
            </Botao>
            <p className="mt-6 text-legenda text-tinta-suave">
              Ao continuar, aceita os{" "}
              <Ligacao href="#termos" className="font-medium text-accao underline underline-offset-2">
                Termos
              </Ligacao>{" "}
              e a{" "}
              <Ligacao href="#privacidade" className="font-medium text-accao underline underline-offset-2">
                Política de Privacidade
              </Ligacao>
              .
            </p>
          </form>
        )}

        {estado === "password" && (
          <form onSubmit={(e) => e.preventDefault()}>
            <Botao variante="fantasma" className="-ml-3 mb-4 px-3" onClick={() => ir("email", -1)}>
              <ArrowLeft /> {email}
            </Botao>
            <h1 className="text-titulo-m text-tinta">Bem-vinda de volta</h1>
            <p className="mt-2 text-corpo text-tinta-suave">Escreva a sua password.</p>
            <input type="email" autoComplete="username" value={email} readOnly hidden />
            <CampoPassword rotulo="Password" autoComplete="current-password" textos={TEXTOS_PASSWORD} className="mt-8" />
            <Botao type="submit" larguraTotal className="mt-6">
              Entrar
            </Botao>
            <Ligacao
              href="#recuperar"
              className="mt-4 inline-flex min-h-alvo-app items-center rounded-controlo text-corpo font-medium text-accao underline-offset-4 hover:underline"
            >
              Esqueci-me da password
            </Ligacao>
          </form>
        )}

        {estado === "criar" && (
          <form onSubmit={(e) => e.preventDefault()}>
            <Botao variante="fantasma" className="-ml-3 mb-4 px-3" onClick={() => ir("email", -1)}>
              <ArrowLeft /> {email}
            </Botao>
            <h1 className="text-titulo-m text-tinta">Criar a sua conta</h1>
            <p className="mt-2 text-corpo text-tinta-suave">Ainda não há uma conta com este email. Falta pouco.</p>
            <div className="mt-8 flex flex-col gap-6">
              <Campo rotulo="O seu nome" autoComplete="name" />
              <CampoPassword
                rotulo="Escolha uma password"
                ajuda="Pelo menos 8 caracteres, com letras e números."
                autoComplete="new-password"
                textos={TEXTOS_PASSWORD}
              />
            </div>
            <Aviso className="mt-6">
              As contas são para maiores de 18 anos. Se é para uma criança, crie-a em seu nome.
            </Aviso>
            <Botao type="submit" larguraTotal className="mt-6">
              Criar conta
            </Botao>
          </form>
        )}
      </TransicaoPasso>
    </LayoutEntrada>
  );
};
