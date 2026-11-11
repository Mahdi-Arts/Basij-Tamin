/* Copyright © 2026 Mahdi Baghbanpour. Proprietary project; see ../../LICENSE.md. */

/*
 * پیکربندی عمومی اتصال درگاه.
 * هرگز merchant key، secret یا token را در این فایل قرار ندهید.
 * قبل از انتشار رسمی، این مقادیر باید با قرارداد backend سازمان تکمیل شوند.
 */
window.PAYMENT_CONFIG = Object.freeze({
  mode: 'demo',
  createPaymentUrl: '',
  allowedRedirectOrigins: [],
  requestTimeoutMs: 15000
});
