/** Finance receipt-preview port. F1 only creates and revokes browser-local object URLs. */
export function assertReceiptPreview(preview) {
  if (typeof preview?.select !== "function" || typeof preview?.release !== "function") {
    throw new TypeError("ReceiptPreview select/release are required");
  }
  return preview;
}
