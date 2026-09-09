import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { UploadCloud, File as FileIcon, X } from "lucide-react";
import { toast } from "sonner";

interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const TIPOS_ACEITES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB, igual ao indicado na UI

const validarFicheiro = (file: File): string | null => {
  if (!TIPOS_ACEITES.includes(file.type)) {
    return "Formato não suportado. Envie um PDF, PNG, JPG ou WEBP.";
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return "O ficheiro excede o limite de 5MB.";
  }
  return null;
};

const FileDropzone = ({ file, onFileChange }: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const tentarSelecionar = (candidato: File | undefined | null) => {
    if (!candidato) return;
    const erro = validarFicheiro(candidato);
    if (erro) {
      toast.error(erro);
      return;
    }
    onFileChange(candidato);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    tentarSelecionar(e.target.files?.[0]);
    e.target.value = ""; // permite escolher o mesmo ficheiro outra vez
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    tentarSelecionar(e.dataTransfer.files?.[0]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  if (file) {
    return (
      <div className="w-full max-w-full rounded-lg border border-teal/30 bg-teal/5 p-3 flex items-center justify-between gap-3 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
            <FileIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate block">
              {file.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onFileChange(null)}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-black/10 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2"
          aria-label={`Remover ficheiro ${file.name}`}
          title="Remover ficheiro"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Anexar comprovativo: clique ou arraste um ficheiro PDF, PNG, JPG ou WEBP, até 5MB"
      onClick={() => inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`w-full cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 ${
        isDragging ? "border-teal bg-teal/5 scale-[0.98]" : "border-border hover:border-navy/50 hover:bg-accent/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={TIPOS_ACEITES.join(",")}
        onChange={handleFileSelect}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="rounded-full bg-navy/10 p-3 text-navy">
        <UploadCloud className="h-6 w-6" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Clique ou arraste para anexar
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, PNG, JPG ou WEBP (Máx. 5MB)
        </p>
      </div>
    </div>
  );
};

export default FileDropzone;
