import { useState } from "react";
import { z } from "zod";
import { MessageSquare, Star, X, Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { feedbackApi, mensagemDeErroApi } from "@/lib/apiClient";
import { useFeedback } from "@/contexts/FeedbackContext";

const feedbackSchema = z.object({
  rating: z.number().int().min(1, "Escolha uma classificação de 1 a 5").max(5),
  comment: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
});

const FeedbackWidget = () => {
  const { isOpen, options, openFeedback, closeFeedback } = useFeedback();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const question = options.question ?? "Como avalia a sua experiência hoje?";

  const resetForm = () => {
    setRating(0);
    setHover(0);
    setComment("");
    setSubmitted(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    closeFeedback();
    // Give the exit animation a beat before resetting form state.
    setTimeout(resetForm, 200);
  };

  const submit = async () => {
    const result = feedbackSchema.safeParse({ rating, comment });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Verifique os campos.");
      return;
    }

    setSubmitting(true);
    try {
      // A API associa o feedback a quem tem sessão automaticamente (cookie
      // httpOnly) -- funciona também sem sessão nenhuma, de propósito.
      await feedbackApi.registar(rating, comment.trim());

      setSubmitted(true);
      toast.success("Obrigado pelo seu feedback!");
      setTimeout(handleClose, 1600);
      // Notificação por email ao admin fica pendente de um fornecedor de
      // email para a infra nova (ver docs/BACKLOG.md) -- o feedback em si
      // já está gravado, o que importa não se perde.
    } catch (err) {
      console.error("Feedback submission failed:", err);
      toast.error(mensagemDeErroApi(err, "Não foi possível registar o feedback. Tente novamente."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 print:hidden">
      {!isOpen && (
        <button
          type="button"
          onClick={() => openFeedback()}
          aria-label="Abrir caixa de feedback"
          className="group flex items-center gap-2 rounded-full bg-navy text-navy-foreground pl-4 pr-5 py-3 shadow-elevated hover:shadow-[0_20px_45px_-12px_hsl(207_85%_15%/0.55)] hover:-translate-y-0.5 transition-all"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal text-teal-foreground">
            <MessageSquare className="w-4 h-4" />
          </span>
          <span className="text-sm font-semibold">Feedback</span>
        </button>
      )}

      {isOpen && (
        <div className="w-[320px] sm:w-[360px] rounded-2xl bg-card border border-border/70 shadow-elevated overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-navy to-teal/80 text-primary-foreground p-5">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar"
              className="absolute top-3 right-3 p-1 rounded-md hover:bg-primary-foreground/15 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-gold mb-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Caixa de Perguntas
            </div>
            <p className="text-base font-semibold leading-snug pr-6">{question}</p>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-4 gap-2">
                <span className="w-12 h-12 rounded-full bg-teal/15 text-teal flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">A sua resposta foi registada.</p>
                <p className="text-xs text-muted-foreground">Vai ajudar-nos a melhorar a plataforma.</p>
              </div>
            ) : (
              <>
                <div>
                  <div
                    className="flex items-center justify-between gap-1"
                    onMouseLeave={() => setHover(0)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (hover || rating) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHover(n)}
                          onClick={() => setRating(n)}
                          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                          className="p-1.5 rounded-md hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-teal"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              active ? "fill-gold text-gold" : "text-muted-foreground/40"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {rating === 0
                      ? "Toque numa estrela para avaliar"
                      : ["Muito fraco", "Fraco", "Razoável", "Bom", "Excelente"][rating - 1]}
                  </p>
                </div>

                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Deixe um comentário (opcional)"
                  rows={2}
                  maxLength={500}
                  className="resize-none text-sm"
                  disabled={submitting}
                />

                <Button
                  onClick={submit}
                  disabled={rating === 0 || submitting}
                  className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      A enviar...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Resposta
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackWidget;
