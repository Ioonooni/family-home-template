import { describe, expect, it, vi } from "vitest";
import { discardReceiptDraft, releaseSavedReceipts, removeReceiptFromDraft } from "./receiptDraft.js";

const persistedLocal = { id: "saved-local", previewUrl: "blob:saved", persisted: true };
const persistedDrive = { id: "saved-drive", previewUrl: "blob:drive", persisted: true, previewReleasable: true };
const unsaved = { id: "new", previewUrl: "blob:new" };

describe("receipt draft lifecycle", () => {
  it("keeps legacy persisted previews but releases ephemeral Drive previews on cancel", () => {
    const release = vi.fn();
    discardReceiptDraft([persistedLocal, persistedDrive, unsaved], release);
    expect(release).toHaveBeenCalledWith(persistedDrive);
    expect(release).toHaveBeenCalledWith(unsaved);
    expect(release).not.toHaveBeenCalledWith(persistedLocal);
  });

  it("releases newly selected or ephemeral Drive preview when removed", () => {
    const release = vi.fn();
    expect(removeReceiptFromDraft([unsaved, persistedDrive], unsaved.id, release)).toEqual([persistedDrive]);
    expect(removeReceiptFromDraft([persistedDrive], persistedDrive.id, release)).toEqual([]);
    expect(release).toHaveBeenCalledWith(unsaved);
    expect(release).toHaveBeenCalledWith(persistedDrive);
  });

  it("releases all saved previews after a confirmed save or delete", () => {
    const release = vi.fn();
    releaseSavedReceipts([persistedLocal, persistedDrive], release);
    expect(release).toHaveBeenCalledWith(persistedDrive);
    expect(release).toHaveBeenCalledWith(persistedLocal);
  });
});
