export interface DadosBancarios {
  beneficiario: string;
  pagamento_rapido: { metodo: string; telefone: string };
  transferencia_nacional: { banco: string; iban: string };
}

/** Dados bancários partilhados por qualquer fluxo de pagamento manual
 * (doações financeiras, checkout Premium) -- fonte única para não haver o
 * risco de dois sítios do site mostrarem dados diferentes. */
export const DEFAULT_BANK_DATA: DadosBancarios = {
  beneficiario: "Dalva Etelvina Benguela Filipe",
  pagamento_rapido: {
    metodo: "MULTICAIXA EXPRESS",
    telefone: "+244 946 538 507",
  },
  transferencia_nacional: {
    banco: "BAI",
    iban: "AO06 0040 0000 9103 4094 1018 9",
  },
};

/** Oculta o meio de um valor sensível (telefone, IBAN) para exibição. */
export const ofuscarValor = (valor: string): string =>
  valor.length <= 8 ? valor : `${valor.slice(0, 4)}****${valor.slice(-4)}`;

/** Converte o ficheiro binário (PDF ou imagem) para base64 para envio seguro via Edge Function. */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = (error) => reject(error);
  });
};
