/**
 * Barrels de dominio - Pix Copia e Cola / BR Code (AGENTS.md secao 7).
 * Importe via `@/domain/pix` (nunca caminhos profundos).
 */

export {
  calculatePixCrc16,
  decodePixBrCode,
  detectPixKeyType,
  formatEmvField,
  formatPixAmount,
  generatePixBrCode,
  normalizePixKey,
  sanitizeMerchantText,
  sanitizeTxId,
  validatePixBrCode,
} from "./pix-br-code";

export {
  drawQrCodeToCanvas,
  drawQrMatrixToCanvas,
  generateQrCodeMatrix,
  renderQrCodeSvg,
} from "./qr-code";

export type {
  DecodedPixBrCode,
  GeneratePixBrCodeOptions,
  PixKeyType,
} from "./pix-br-code";

export type {
  DrawQrCodeOptions,
  GenerateQrCodeOptions,
  QrCodeEccLevel,
} from "./qr-code";

