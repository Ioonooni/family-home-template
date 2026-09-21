import { expect, it, vi } from "vitest";
import { createInMemoryTransactionRepository } from "../testing/inMemoryTransactionRepository.js";
import { createFinanceSetupService } from "./financeSetupService.js";

it("authorization or resource failure does not mutate mock transactions", async () => {
  const repository = createInMemoryTransactionRepository(); const before = await repository.list();
  const setup = createFinanceSetupService({ authorization: { authorize: vi.fn().mockResolvedValue("token"), clear: vi.fn() }, resourceBootstrap: { prepare: vi.fn().mockRejectedValue(new Error("Drive failed")) } });
  await expect(setup.connect()).rejects.toThrow("Drive failed"); expect(await repository.list()).toEqual(before);
});

it("connects Sheet and receipt storage with the same memory-only token", async () => {
  const transactionRepository = { connect: vi.fn(), disconnect: vi.fn() };
  const receiptStorage = { connect: vi.fn(), disconnect: vi.fn() };
  const setup = createFinanceSetupService({
    authorization: { authorize: vi.fn().mockResolvedValue("memory-token"), clear: vi.fn() },
    resourceBootstrap: { prepare: vi.fn().mockResolvedValue({ spreadsheetId: "sheet-1", folderId: "folder-1" }) },
    transactionRepository, receiptStorage,
  });
  await expect(setup.connect()).resolves.toMatchObject({ spreadsheetId: "sheet-1", folderId: "folder-1" });
  expect(transactionRepository.connect).toHaveBeenCalledWith({ accessToken: "memory-token", spreadsheetId: "sheet-1" });
  expect(receiptStorage.connect).toHaveBeenCalledWith({ accessToken: "memory-token", folderId: "folder-1" });
});
