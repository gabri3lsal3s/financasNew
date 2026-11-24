import { isValidCPF } from "@/domain/validation";
import { isValidCep, isValidPhoneBR } from "@/services/masks";

export type CheckoutPaymentMethod = "credit_card" | "pix";

export interface ValidateCheckoutParams {
  hasSession: boolean;
  authMode: "register" | "login";
  authName: string;
  authEmail: string;
  authPassword: string;
  cpf: string;
  activeMethod: CheckoutPaymentMethod;
  holderName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCcv: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
}

/**
 * Valida os campos de identificação, CPF e cartão antes de enviar o checkout.
 * Retorna uma mensagem de erro legível para o usuário ou `null` quando válido.
 */
export function validateCheckoutFields(params: ValidateCheckoutParams): string | null {
  if (!params.hasSession) {
    if (!params.authEmail.trim() || !params.authPassword.trim()) {
      return "Informe e-mail e senha para criar ou acessar sua conta.";
    }
    if (params.authMode === "register" && !params.authName.trim()) {
      return "Informe seu nome completo para o cadastro.";
    }
    if (params.authMode === "register" && params.authPassword.length < 8) {
      return "A senha deve possuir no mínimo 8 caracteres.";
    }
    if (params.authMode === "login" && params.authPassword.length < 6) {
      return "A senha deve possuir no mínimo 6 caracteres.";
    }
  }

  if (!params.cpf || !isValidCPF(params.cpf)) {
    return "Informe um CPF válido para emissão do pagamento.";
  }

  if (params.activeMethod === "credit_card") {
    if (!params.holderName.trim()) {
      return "Informe o nome do titular como impresso no cartão.";
    }
    const rawNumber = params.cardNumber.replace(/\D/g, "");
    if (rawNumber.length < 13 || rawNumber.length > 19) {
      return "Número do cartão de crédito inválido.";
    }
    const [expMonth, expYear] = params.cardExpiry.split("/");
    const parsedMonth = expMonth ? parseInt(expMonth, 10) : 0;
    if (!expMonth || !expYear || parsedMonth < 1 || parsedMonth > 12) {
      return "Validade do cartão inválida (formato MM/AA).";
    }
    if (params.cardCcv.length < 3) {
      return "Código de segurança (CVV) inválido.";
    }
    if (!isValidPhoneBR(params.phone)) {
      return "Informe um telefone válido com DDD para validação do cartão.";
    }
    if (!isValidCep(params.postalCode)) {
      return "Informe um CEP válido (8 dígitos) do endereço de cobrança.";
    }
    if (!params.addressNumber.trim()) {
      return "Informe o número do endereço de cobrança (ou S/N).";
    }
  }

  return null;
}
