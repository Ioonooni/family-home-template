function shouldReleaseDraftPreview(receipt) {
  return !receipt?.persisted || receipt?.previewReleasable === true;
}

export function discardReceiptDraft(receipts, release) {
  receipts.filter(shouldReleaseDraftPreview).forEach((receipt) => release(receipt));
}

export function removeReceiptFromDraft(receipts, id, release) {
  const receipt = receipts.find((item) => item.id === id);
  if (receipt && shouldReleaseDraftPreview(receipt)) release(receipt);
  return receipts.filter((item) => item.id !== id);
}

export function releaseSavedReceipts(receipts, release) {
  receipts.forEach((receipt) => release(receipt));
}
