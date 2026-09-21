import { describe, expect, it } from "vitest";
import { filterTransactions, summarizeTransactions, validateTransaction } from "./transaction.js";

const items = [
  { id: "1", accountType: "family", transactionType: "income", amount: 1000, category: "เงินเดือน", transactionDate: "2026-09-02", createdAt: "2" },
  { id: "2", accountType: "family", transactionType: "expense", amount: 250, category: "ค่าอาหาร", transactionDate: "2026-09-03", createdAt: "1" },
  { id: "3", accountType: "business", transactionType: "income", amount: 500, category: "รายได้บริการ", transactionDate: "2026-09-04", createdAt: "3" },
];
describe("finance domain", () => {
  it("filters by account, month and year newest first", () => expect(filterTransactions(items, { accountType: "family", month: 9, year: 2026 }).map((item) => item.id)).toEqual(["2", "1"]));
  it("calculates income expense and balance", () => expect(summarizeTransactions(items.slice(0, 2))).toEqual({ income: 1000, expense: 250, balance: 750 }));
  it("validates required fields and positive amount", () => expect(validateTransaction({ accountType: "family", transactionType: "expense", amount: 0, category: "", transactionDate: "" })).toMatchObject({ amount: expect.any(String), category: expect.any(String), transactionDate: expect.any(String) }));
});
