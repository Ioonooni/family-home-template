/** Finance receipt-file persistence port. Receipt metadata remains in the Finance Sheet. */
export function assertReceiptStorage(storage) {
  for (const method of ["connect", "disconnect", "upload", "preview", "delete"]) {
    if (typeof storage?.[method] !== "function") throw new TypeError(`ReceiptStorage.${method} is required`);
  }
  return storage;
}
