import { describe, expect, it, vi } from "vitest";
import { createGoogleDriveReceiptStorage } from "./googleDriveReceiptStorage.js";

function response({ ok = true, status = 200, json = {}, blob = new Blob(["image"]), location = null } = {}) {
  return {
    ok, status,
    json: async () => json,
    blob: async () => blob,
    headers: { get: (name) => name === "Location" ? location : null },
  };
}

describe("Google Drive receipt storage", () => {
  it("requires an in-memory connection", async () => {
    const storage = createGoogleDriveReceiptStorage();
    await expect(storage.preview({ id: "r1" })).rejects.toMatchObject({ code: "not-connected" });
  });

  it("uploads with a resumable session into the Finance folder", async () => {
    const fetchApi = vi.fn()
      .mockResolvedValueOnce(response({ location: "https://upload.example/session" }))
      .mockResolvedValueOnce(response({ json: { id: "drive-1", name: "bill.jpg", mimeType: "image/jpeg", size: "4" } }));
    const storage = createGoogleDriveReceiptStorage({ fetchApi });
    storage.connect({ accessToken: "token", folderId: "finance-folder" });
    const file = new File(["test"], "bill.jpg", { type: "image/jpeg" });
    await expect(storage.upload("tx-1", { file, name: file.name })).resolves.toEqual({
      id: "drive-1", name: "bill.jpg", mimeType: "image/jpeg", size: 4,
    });
    const metadata = JSON.parse(fetchApi.mock.calls[0][1].body);
    expect(metadata.parents).toEqual(["finance-folder"]);
    expect(metadata.appProperties).toMatchObject({ product: "family-home-finance", resource: "receipt", transactionId: "tx-1" });
    expect(fetchApi.mock.calls[1][0]).toBe("https://upload.example/session");
  });

  it("downloads a persisted receipt into a releasable object URL", async () => {
    const urlApi = { createObjectURL: vi.fn(() => "blob:drive-preview") };
    const storage = createGoogleDriveReceiptStorage({ fetchApi: vi.fn().mockResolvedValue(response()), urlApi });
    storage.connect({ accessToken: "token", folderId: "folder" });
    await expect(storage.preview({ id: "drive-1", name: "bill.jpg", mimeType: "image/jpeg" })).resolves.toMatchObject({
      id: "drive-1", persisted: true, previewReleasable: true, previewUrl: "blob:drive-preview",
    });
  });

  it("moves deleted receipt files to Drive trash and maps authorization expiry", async () => {
    const fetchApi = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response({ ok: false, status: 401 }));
    const storage = createGoogleDriveReceiptStorage({ fetchApi });
    storage.connect({ accessToken: "token", folderId: "folder" });
    await storage.delete({ id: "drive-1" });
    expect(JSON.parse(fetchApi.mock.calls[0][1].body)).toEqual({ trashed: true });
    await expect(storage.preview({ id: "drive-2" })).rejects.toMatchObject({ code: "reconnect-required" });
  });
});
