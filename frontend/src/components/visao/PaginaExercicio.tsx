import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { localizar } from "@/i18n/rotas";

/** Moldura de página comum aos testes e treinos (Navbar, voltar, rodapé). */
const PaginaExercicio = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20 pb-16 md:pt-24">
        <div className="container max-w-4xl mx-auto px-4">
          <Button variant="ghost" asChild className="mb-4">
            <Link to={localizar("/exercicios")}>
              <ArrowLeft className="w-4 h-4" />
              {t("Visao.voltarAosExercicios")}
            </Link>
          </Button>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaginaExercicio;
