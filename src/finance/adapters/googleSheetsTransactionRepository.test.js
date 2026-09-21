import { describe, expect, it } from "vitest";
import { createGoogleSheetsTransactionRepository, TRANSACTION_HEADERS } from "./googleSheetsTransactionRepository.js";

function fakeSheets(initialRows = [], initialHeaders = []) {
  const state = { headers: [...initialHeaders], rows: structuredClone(initialRows), headerWrites: 0 };
  const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(data) });
  const fetchApi = async (url, options = {}) => {
    const method = options.method || "GET";
    if (url.endsWith("?fields=sheets.properties(sheetId,title,index)")) return response({ sheets: [{ properties: { sheetId: 7, title: "Sheet1", index: 0 } }] });
    const decoded = decodeURIComponent(url);

    if (decoded.includes("'Sheet1'!A1:J1")) {
      if (method === "PUT") { state.headers = JSON.parse(options.body).values[0]; state.headerWrites += 1; return response({}); }
      return response({ values: state.headers.length ? [state.headers] : [] });
    }
    if (decoded.includes("'Sheet1'!J1:J1") && method === "PUT") {
      state.headers[9] = JSON.parse(options.body).values[0][0]; state.headerWrites += 1; return response({});
    }
    if (decoded.includes("'Sheet1'!A2:J") && method === "GET") return response({ values: state.rows });
    if (decoded.includes("'Sheet1'!A:J:append") && method === "POST") { state.rows.push(JSON.parse(options.body).values[0]); return response({}); }
    const updateRow = decoded.match(/'Sheet1'!A(\d+):J\d+/);
    if (updateRow && method === "PUT") { state.rows[Number(updateRow[1]) - 2] = JSON.parse(options.body).values[0]; return response({}); }
    if (url.endsWith(":batchUpdate") && method === "POST") {
      const range = JSON.parse(options.body).requests[0].deleteDimension.range;
      expect(range.sheetId).toBe(7);
      state.rows.splice(range.startIndex - 1, range.endIndex - range.startIndex);
      return response({});
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  return { state, fetchApi };
}

const draft = { accountType: "family", transactionType: "expense", transactionDate: "2026-09-20", amount: 1250, category: "ค่าอาหาร", note: "ตลาด", receipts: [] };

describe("Google Sheets transaction repository", () => {
  it("initializes the exact header once and does not duplicate it on reconnect", async () => {
    const sheet = fakeSheets(); const repository = createGoogleSheetsTransactionRepository({ fetchApi: sheet.fetchApi });
    await repository.connect({ accessToken: "token", spreadsheetId: "spreadsheet" });
    await repository.connect({ accessToken: "token-2", spreadsheetId: "spreadsheet" });
    expect(sheet.state.headers).toEqual(TRANSACTION_HEADERS); expect(sheet.state.headerWrites).toBe(1); expect(sheet.state.rows).toHaveLength(0);
  });

  it("migrates the exact F3 header by appending the receipts column once", async () => {
    const oldHeaders = TRANSACTION_HEADERS.slice(0, -1);
    const sheet = fakeSheets([], oldHeaders); const repository = createGoogleSheetsTransactionRepository({ fetchApi: sheet.fetchApi });
    await repository.connect({ accessToken: "token", spreadsheetId: "spreadsheet" });
    await repository.connect({ accessToken: "token-2", spreadsheetId: "spreadsheet" });
    expect(sheet.state.headers).toEqual(TRANSACTION_HEADERS); expect(sheet.state.headerWrites).toBe(1);
  });

  it("rejects a non-empty incompatible schema without overwriting it", async () => {
    const sheet = fakeSheets([], ["wrong"]); const repository = createGoogleSheetsTransactionRepository({ fetchApi: sheet.fetchApi });
    await expect(repository.connect({ accessToken: "token", spreadsheetId: "spreadsheet" })).rejects.toMatchObject({ code: "schema-mismatch" });
    expect(sheet.state.headers).toEqual(["wrong"]); expect(sheet.state.headerWrites).toBe(0);
  });

  it("persists CRUD plus receipt metadata using domain field names", async () => {
    const sheet = fakeSheets([], TRANSACTION_HEADERS); let clock = 0;
    const repository = createGoogleSheetsTransactionRepository({ fetchApi: sheet.fetchApi, createId: () => "tx-1", now: () => `2026-09-20T00:00:0${clock++}.000Z` });
    await repository.connect({ accessToken: "token", spreadsheetId: "spreadsheet" });
    expect(await repository.create(draft)).toMatchObject({ id: "tx-1", accountType: "family", transactionType: "expense", amount: 1250 });
    expect(await repository.list()).toHaveLength(1);
    const receipt = { id: "drive-1", name: "bill.jpg", mimeType: "image/jpeg", size: 123 };
    expect(await repository.update("tx-1", { ...draft, receipts: [receipt], accountType: "business", transactionType: "income", amount: 2000 }))
      .toMatchObject({ accountType: "business", transactionType: "income", amount: 2000, receipts: [receipt] });
    expect(await repository.get("tx-1")).toMatchObject({ category: "ค่าอาหาร", receipts: [receipt] });
    await repository.delete("tx-1"); expect(await repository.list()).toEqual([]);
  });

  it("keeps persisted rows available to a new repository instance", async () => {
    const sheet = fakeSheets([], TRANSACTION_HEADERS);
    const first = createGoogleSheetsTransactionRepository({ fetchApi: sheet.fetchApi, createId: () => "tx-reload" });
    await first.connect({ accessToken: "token", spreadsheetId: "spreadsheet" }); await first.create(draft);
    const reloaded = createGoogleSheetsTransactionRepository({ fetchApi: sheet.fetchApi });
    await reloaded.connect({ accessToken: "new-token", spreadsheetId: "spreadsheet" });
    expect(await reloaded.list()).toEqual([expect.objectContaining({ id: "tx-reload", amount: 1250, receipts: [] })]);
  });

  it("requires an in-memory connection and maps authorization expiry", async () => {
    const repository = createGoogleSheetsTransactionRepository();
    await expect(repository.list()).rejects.toMatchObject({ code: "not-connected" });
    const expired = createGoogleSheetsTransactionRepository({ fetchApi: async () => ({ ok: false, status: 401, json: async () => ({}) }) });
    await expect(expired.connect({ accessToken: "expired", spreadsheetId: "spreadsheet" })).rejects.toMatchObject({ code: "reconnect-required" });
  });
});
