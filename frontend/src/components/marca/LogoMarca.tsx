/**
 * Símbolo da marca (o olho dentro da janela), em SVG, a partir da folha de
 * marca de 2026-10-26: versão clara (janela azul) para fundos claros e versão
 * escura (janela lima) para o azul-marinho. Substitui o `logo-icon.png` no
 * cabeçalho e no rodapé -- o PNG tem margens brancas largas e fundo opaco.
 */
interface LogoMarcaProps {
  variante?: "claro" | "escuro";
  className?: string;
}

const LogoMarca = ({ variante = "claro", className }: LogoMarcaProps) => {
  const janela = variante === "escuro" ? "#DCEBA3" : "#0060A8";
  return (
    <svg viewBox="520 195 950 712" className={className} aria-hidden="true" focusable="false">
      <rect x="681" y="226" width="650" height="650" fill="none" stroke={janela} strokeWidth="44" opacity="0.75" />
      <path
        d="M566 551 L690 427 Q994 152 1298 427 L1422 551 L1298 675 Q994 950 690 675 Z"
        fill="none"
        stroke="#14B5AE"
        strokeWidth="52"
        strokeLinejoin="miter"
        opacity="0.92"
      />
      <circle cx="994" cy="551" r="120" fill="#0060A8" />
      <circle cx="994" cy="551" r="67" fill="#001F54" />
      <circle cx="951" cy="508" r="23" fill="#FAFDEF" />
    </svg>
  );
};

export default LogoMarca;
