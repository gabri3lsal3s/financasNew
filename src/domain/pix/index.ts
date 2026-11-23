/**
 * Barrels de dominio - Pix Copia e Cola / BR Code (AGENTS.md secao 7).
 * Importe via `@/domain/pix` (nunca caminhos profundos).
 */

export {
  DEFAULT_PIX_CITY,
  DEFAULT_PIX_MERCHANT_NAME,
  calculatePixCrc16,
  decodePixBrCode,
  detectPixKeyType,
  extractBrazilianPhoneLocalDigits,
  formatEmvField,
  formatPixAmount,
  generatePixBrCode,
  normalizePixKey,
  sanitizeMerchantText,
  sanitizePixCity,
  sanitizePixMerchantName,
  sanitizeTxId,
  stripInvisiblePixChars,
  truncateAtWordBoundary,
  validatePixBrCode,
} from "./pix-br-code";

export {
  buildPixTransferCode,
  resolvePixKeyType,
} from "./build-pix-transfer-code";

export {
  formatPixKeyTypeLabel,
  isValidBrazilianPhoneDigits,
  isValidCNPJ,
  validateAndClassifyPixKey,
  type PixKeyValidationResult,
} from "./pix-key-validation";

export {
  inspectPixPaymentPayload,
  verifyPixConfiguration,
  type InspectPixPaymentPayloadInput,
  type PixConfigurationDiagnosis,
  type PixConfigurationStatus,
  type PixPaymentInspection,
  type VerifyPixConfigurationInput,
} from "./pix-diagnostics";

export {
  drawQrCodeToCanvas,
  drawQrMatrixToCanvas,
  generateQrCodeMatrix,
  renderQrCodeSvg,
} from "./qr-code";

export type { BuildPixTransferCodeOptions } from "./build-pix-transfer-code";

export type {
  DecodedPixBrCode,
  GeneratePixBrCodeOptions,
  PixKeyType,
  PixSanitizedFieldResult,
} from "./pix-br-code";

export type {
  DrawQrCodeOptions,
  GenerateQrCodeOptions,
  QrCodeEccLevel,
} from "./qr-code";

