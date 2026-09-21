const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export class FinanceReceiptError extends Error {
  constructor(code, message) { super(message); this.name = "FinanceReceiptError"; this.code = code; }
}

function cleanMetadata(receipt) {
  return {
    id: receipt.id,
    name: receipt.name,
    mimeType: receipt.mimeType || "application/octet-stream",
    size: Number(receipt.size || 0),
  };
}

export function createGoogleDriveReceiptStorage({ fetchApi = fetch, urlApi = URL } = {}) {
  let connection = null;

  function requireConnection() {
    if (!connection) throw new FinanceReceiptError("not-connected", "กรุณาเชื่อมต่อ Google ก่อนใช้งานใบเสร็จ");
    return connection;
  }

  async function checked(response, fallbackCode = "drive-receipt-failure") {
    if (response.status === 401 || response.status === 403) throw new FinanceReceiptError("reconnect-required", "ต้องเชื่อมต่อ Google ใหม่");
    if (!response.ok) throw new FinanceReceiptError(fallbackCode, "ไม่สามารถจัดการไฟล์ใบเสร็จได้");
    return response;
  }

  return {
    connect({ accessToken, folderId }) {
      if (!accessToken || !folderId) throw new FinanceReceiptError("reconnect-required", "ต้องเชื่อมต่อ Google ใหม่");
      connection = { accessToken, folderId };
    },

    disconnect() { connection = null; },

    async upload(transactionId, receipt) {
      const { accessToken, folderId } = requireConnection();
      const file = receipt?.file;
      if (!transactionId || !file) throw new FinanceReceiptError("invalid-receipt", "ไม่พบไฟล์ใบเสร็จที่ต้องการอัปโหลด");

      const metadata = {
        name: file.name || receipt.name || "receipt",
        parents: [folderId],
        appProperties: { product: "family-home-finance", resource: "receipt", transactionId },
      };
      const start = await checked(await fetchApi(
        `${DRIVE_UPLOAD_URL}?uploadType=resumable&fields=id,name,mimeType,size`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Type": file.type || "application/octet-stream",
            "X-Upload-Content-Length": String(file.size ?? 0),
          },
          body: JSON.stringify(metadata),
        },
      ), "receipt-upload-failure");

      const uploadUrl = start.headers?.get?.("Location");
      if (!uploadUrl) throw new FinanceReceiptError("receipt-upload-failure", "ไม่สามารถเริ่มอัปโหลดใบเสร็จได้");

      const finish = await checked(await fetchApi(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      }), "receipt-upload-failure");
      const result = await finish.json();
      return cleanMetadata({
        id: result.id,
        name: result.name || file.name,
        mimeType: result.mimeType || file.type,
        size: result.size || file.size,
      });
    },

    async preview(receipt) {
      const { accessToken } = requireConnection();
      if (!receipt?.id) throw new FinanceReceiptError("invalid-receipt", "ไม่พบไฟล์ใบเสร็จ");
      const response = await checked(await fetchApi(
        `${DRIVE_FILES_URL}/${encodeURIComponent(receipt.id)}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ), "receipt-preview-failure");
      const blob = await response.blob();
      return { ...cleanMetadata(receipt), persisted: true, previewReleasable: true, previewUrl: urlApi.createObjectURL(blob) };
    },

    async delete(receipt) {
      const { accessToken } = requireConnection();
      if (!receipt?.id) return;
      await checked(await fetchApi(
        `${DRIVE_FILES_URL}/${encodeURIComponent(receipt.id)}?fields=id,trashed`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        },
      ), "receipt-delete-failure");
    },
  };
}
