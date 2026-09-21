export function createLocalReceiptPreview(urlApi = URL) {
  return {
    select(files) {
      return Array.from(files).map((file, index) => ({
        id: `local-${Date.now()}-${index}`,
        name: file.name,
        file,
        previewUrl: urlApi.createObjectURL(file),
      }));
    },
    release(receipt) { if (receipt?.previewUrl) urlApi.revokeObjectURL(receipt.previewUrl); },
  };
}
