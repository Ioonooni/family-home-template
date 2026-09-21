import { describe, expect, it, vi } from "vitest";
import { createInMemoryTransactionRepository } from "../testing/inMemoryTransactionRepository.js";
import { createFinanceService } from "./financeService.js";

function makeStorage() {
  let sequence = 0;
  return {
    connect: vi.fn(), disconnect: vi.fn(),
    upload: vi.fn(async (_transactionId, receipt) => ({ id: `drive-${++sequence}`, name: receipt.name, mimeType: receipt.file?.type || "image/jpeg", size: receipt.file?.size || 1 })),
    preview: vi.fn(async (receipt) => ({ ...receipt, persisted: true, previewReleasable: true, previewUrl: `blob:${receipt.id}` })),
    delete: vi.fn(async () => {}),
  };
}
function service(repository = createInMemoryTransactionRepository([]), receiptStorage = makeStorage()) {
  return { api: createFinanceService({ repository, receiptPreview: { select: vi.fn(() => []), release: vi.fn() }, receiptStorage }), repository, receiptStorage };
}
const draft = { accountType: "family", transactionType: "expense", amount: 100, category: " ค่าอาหาร ", note: "", transactionDate: "2026-09-19", receipts: [] };

describe("finance application service", () => {
  it("creates, reads, edits, and deletes without receipts", async () => {
    const { api } = service();
    const created = await api.save("", draft); expect(created.ok).toBe(true);
    expect((await api.list())).toHaveLength(1);
    const updated = await api.save(created.item.id, { ...draft, amount: 250 }); expect(updated.item.amount).toBe(250);
    await api.delete(created.item.id); expect(await api.list()).toEqual([]);
  });

  it("uploads new receipts, persists only metadata, previews them, and deletes removed files", async () => {
    const { api, repository, receiptStorage } = service();
    const file = new File(["x"], "bill.jpg", { type: "image/jpeg" });
    const created = await api.save("", { ...draft, receipts: [{ id: "local-1", name: "bill.jpg", file, previewUrl: "blob:local" }] });
    expect(created.item.receipts).toEqual([expect.objectContaining({ id: "drive-1", name: "bill.jpg" })]);
    expect(receiptStorage.upload).toHaveBeenCalledWith(created.item.id, expect.objectContaining({ file }));
    const persisted = await repository.get(created.item.id);
    expect(persisted.receipts[0]).not.toHaveProperty("file");
    await expect(api.previewReceipts(persisted.receipts)).resolves.toEqual([expect.objectContaining({ previewUrl: "blob:drive-1", persisted: true })]);

    const updated = await api.save(created.item.id, { ...draft, amount: 200, receipts: [] });
    expect(updated.item.receipts).toEqual([]);
    expect(receiptStorage.delete).toHaveBeenCalledWith(expect.objectContaining({ id: "drive-1" }));
  });

  it("cleans uploaded files and the created row when receipt upload fails", async () => {
    const repository = createInMemoryTransactionRepository([]);
    const receiptStorage = makeStorage();
    receiptStorage.upload.mockRejectedValue(new Error("upload failed"));
    const { api } = service(repository, receiptStorage);
    const file = new File(["x"], "bill.jpg", { type: "image/jpeg" });
    await expect(api.save("", { ...draft, receipts: [{ id: "local-1", name: "bill.jpg", file }] })).rejects.toThrow("upload failed");
    expect(await repository.list()).toEqual([]);
  });

  it("returns validation errors before adapter writes", async () => {
    const { api } = service();
    await expect(api.save("", { ...draft, amount: -1 })).resolves.toMatchObject({ ok: false, errors: { amount: expect.any(String) } });
  });
});
