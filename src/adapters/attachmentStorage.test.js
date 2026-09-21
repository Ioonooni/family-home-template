import { describe, expect, it, vi } from "vitest";
import { createAttachmentStorage } from "./attachmentStorage.js";

function setup() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/file" }, error: null });
  const bucket = { upload, remove, createSignedUrl };
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue(bucket),
    },
  };
  return { client, bucket, storage: createAttachmentStorage(client) };
}

describe("private attachment storage", () => {
  it("uploads inside the authenticated user's folder", async () => {
    const { bucket, storage } = setup();
    const result = await storage.upload({ name: "my file.pdf" });
    expect(result.path).toMatch(/^user-123\/[0-9a-f-]+-my_file\.pdf$/);
    expect(bucket.upload).toHaveBeenCalledWith(result.path, { name: "my file.pdf" });
  });

  it("creates a temporary signed URL", async () => {
    const { bucket, storage } = setup();
    await expect(storage.signedUrl("user-123/file.pdf")).resolves.toBe("https://signed.example/file");
    expect(bucket.createSignedUrl).toHaveBeenCalledWith("user-123/file.pdf", 3600);
  });

  it("requires an authenticated user for uploads", async () => {
    const { client, storage } = setup();
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(storage.upload({ name: "x.pdf" })).rejects.toThrow("กรุณาเข้าสู่ระบบ");
  });
});
