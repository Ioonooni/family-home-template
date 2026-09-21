import { expect, it, vi } from "vitest";
import { createLocalReceiptPreview } from "./localReceiptPreview.js";
it("creates and revokes local receipt preview URLs", () => { const urlApi = { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }; const adapter = createLocalReceiptPreview(urlApi); const [receipt] = adapter.select([{ name: "receipt.jpg" }]); expect(receipt.previewUrl).toBe("blob:preview"); adapter.release(receipt); expect(urlApi.revokeObjectURL).toHaveBeenCalledWith("blob:preview"); });
