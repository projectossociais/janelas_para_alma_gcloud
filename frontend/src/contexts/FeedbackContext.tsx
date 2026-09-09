import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface FeedbackOptions {
  context?: string;
  question?: string;
}

interface FeedbackContextValue {
  isOpen: boolean;
  options: FeedbackOptions;
  openFeedback: (opts?: FeedbackOptions) => void;
  closeFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<FeedbackOptions>({});

  const openFeedback = useCallback((opts: FeedbackOptions = {}) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeFeedback = useCallback(() => setIsOpen(false), []);

  return (
    <FeedbackContext.Provider value={{ isOpen, options, openFeedback, closeFeedback }}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
};
