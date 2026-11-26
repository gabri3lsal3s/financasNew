import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { signInWithEmail, signUpWithEmail } from "@/hooks/use-auth";
import { useSaveSplitExpense, useSignalSplitPayment } from "@/state";
import { classifyError } from "@/services/errors";
import { reportError } from "@/services/observability";
import { triggerSensory } from "@/services/sensory";
import { checkPasswordRequirements, normalizeEmail } from "@/domain/validation";

export function useSplitOnboarding({
  guestShareCents,
  title,
  date,
  token,
  onOpenChange,
  onSuccess,
}: {
  guestShareCents: number;
  title: string;
  date: string;
  token: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const navigate = useNavigate();
  const saveSplitMutation = useSaveSplitExpense();
  const signalSplitPaymentMutation = useSignalSplitPayment();

  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleModeChange = (newMode: "register" | "login") => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Informe um endereço de e-mail válido.");
      triggerSensory("destructive");
      return;
    }

    if (!password) {
      setError("Informe sua senha de acesso.");
      triggerSensory("destructive");
      return;
    }

    if (mode === "register" && !checkPasswordRequirements(password).minLength) {
      setError("A senha deve conter ao menos 8 caracteres.");
      triggerSensory("destructive");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        const signupRes = await signUpWithEmail(cleanEmail, password, name.trim() || undefined);
        if (signupRes.needsEmailConfirmation) {
          triggerSensory("action");
          setConfirmationSent(true);
          try {
            localStorage.setItem(
              "axis_pending_split_expense",
              JSON.stringify({
                token,
                title,
                amountCents: guestShareCents,
                date,
                participantName: name.trim() || cleanEmail.split("@")[0] || "Participante",
              }),
            );
          } catch {
            // Ignora falhas de storage em ambiente restrito
          }
          return;
        }
      } else {
        await signInWithEmail(cleanEmail, password);
      }

      await saveSplitMutation.mutateAsync({ title, amountCents: guestShareCents, date });

      if (token) {
        try {
          await signalSplitPaymentMutation.mutateAsync({
            token,
            participantName: name.trim() || cleanEmail.split("@")[0] || "Participante",
            amountCents: guestShareCents,
          });
        } catch (signalErr) {
          reportError(signalErr, { source: "useSplitOnboarding.signalSplitPayment" });
        }
      }

      triggerSensory("success");
      onOpenChange(false);
      onSuccess?.();
      navigate("/");
    } catch (err) {
      triggerSensory("destructive");
      setError(classifyError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    mode,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    isSubmitting,
    error,
    confirmationSent,
    handleModeChange,
    handleSubmit,
  };
}
