import { validateTransaction } from "../domain/transaction.js";
import { assertTransactionRepository } from "../ports/transactionRepository.js";
import { assertReceiptPreview } from "../ports/receiptPreview.js";
import { assertReceiptStorage } from "../ports/receiptStorage.js";

function receiptMetadata(receipt) {
  return {
    id: receipt.id,
    name: receipt.name,
    mimeType: receipt.mimeType || receipt.file?.type || "application/octet-stream",
    size: Number(receipt.size || receipt.file?.size || 0),
  };
}

export function createFinanceService({ repository, receiptPreview, receiptStorage }) {
  assertTransactionRepository(repository);
  assertReceiptPreview(receiptPreview);
  assertReceiptStorage(receiptStorage);

  function normalized(draft) {
    return { ...draft, amount: Number(draft.amount), category: draft.category.trim(), note: draft.note?.trim() || "", receipts: draft.receipts || [] };
  }

  async function uploadNew(transactionId, receipts) {
    const uploaded = [];
    try {
      for (const receipt of receipts.filter((item) => item?.file)) {
        uploaded.push(await receiptStorage.upload(transactionId, receipt));
      }
      return uploaded;
    } catch (error) {
      await Promise.allSettled(uploaded.map((receipt) => receiptStorage.delete(receipt)));
      throw error;
    }
  }

  return {
    list: () => repository.list(),
    get: (id) => repository.get(id),
    selectReceipts: (files) => receiptPreview.select(files),
    releaseReceipt: (receipt) => receiptPreview.release(receipt),
    previewReceipts: (receipts) => Promise.all((receipts || []).map((receipt) => receiptStorage.preview(receipt))),

    async save(id, draft) {
      const clean = normalized(draft);
      const errors = validateTransaction(clean);
      if (Object.keys(errors).length) return { ok: false, errors };

      if (!id) {
        const created = await repository.create({ ...clean, receipts: [] });
        let uploaded = [];
        try {
          uploaded = await uploadNew(created.id, clean.receipts);
          if (!uploaded.length) return { ok: true, item: created };
          const item = await repository.update(created.id, { ...clean, receipts: uploaded.map(receiptMetadata) });
          return { ok: true, item };
        } catch (error) {
          await Promise.allSettled(uploaded.map((receipt) => receiptStorage.delete(receipt)));
          await Promise.allSettled([repository.delete(created.id)]);
          throw error;
        }
      }

      const existing = await repository.get(id);
      if (!existing) throw new Error("ไม่พบรายการที่ต้องการแก้ไข");

      const retained = clean.receipts.filter((receipt) => !receipt.file).map(receiptMetadata);
      const retainedIds = new Set(retained.map((receipt) => receipt.id));
      const removed = (existing.receipts || []).filter((receipt) => !retainedIds.has(receipt.id));
      const uploaded = await uploadNew(id, clean.receipts);

      let item;
      try {
        item = await repository.update(id, { ...clean, receipts: [...retained, ...uploaded.map(receiptMetadata)] });
      } catch (error) {
        await Promise.allSettled(uploaded.map((receipt) => receiptStorage.delete(receipt)));
        throw error;
      }

      const cleanup = await Promise.allSettled(removed.map((receipt) => receiptStorage.delete(receipt)));
      const warning = cleanup.some((result) => result.status === "rejected") ? "บันทึกรายการแล้ว แต่มีไฟล์ใบเสร็จเดิมที่ลบไม่สำเร็จ" : "";
      return { ok: true, item, warning };
    },

    async delete(id) {
      const existing = await repository.get(id);
      if (!existing) return { warning: "" };
      await repository.delete(id);
      const cleanup = await Promise.allSettled((existing.receipts || []).map((receipt) => receiptStorage.delete(receipt)));
      return { warning: cleanup.some((result) => result.status === "rejected") ? "ลบรายการแล้ว แต่มีไฟล์ใบเสร็จที่ลบไม่สำเร็จ" : "" };
    },
  };
}
