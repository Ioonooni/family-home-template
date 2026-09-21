const SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets";
export const TRANSACTION_HEADERS = Object.freeze(["id", "context", "type", "date", "amount", "category", "note", "createdAt", "updatedAt", "receipts"]);

export class FinanceSheetError extends Error {
  constructor(code, message) { super(message); this.name = "FinanceSheetError"; this.code = code; }
}

function quoteSheet(title) { return `'${title.replaceAll("'", "''")}'`; }
function rowToTransaction(row) {
  return {
    id: row[0], accountType: row[1], transactionType: row[2], transactionDate: row[3], amount: Number(row[4]),
    category: row[5], note: row[6] || "", createdAt: row[7], updatedAt: row[8], receipts: parseReceipts(row[9]),
  };
}
function parseReceipts(value) {
  if (!value) return [];
  try {
    const receipts = JSON.parse(value);
    return Array.isArray(receipts) ? receipts.filter((item) => item?.id && item?.name).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      mimeType: String(item.mimeType || "application/octet-stream"),
      size: Number(item.size || 0),
    })) : [];
  } catch {
    throw new FinanceSheetError("receipt-metadata-invalid", "ข้อมูลใบเสร็จใน Finance Sheet ไม่ถูกต้อง");
  }
}
function transactionToRow(item) {
  const receipts = (item.receipts || []).map(({ id, name, mimeType, size }) => ({ id, name, mimeType, size: Number(size || 0) }));
  return [item.id, item.accountType, item.transactionType, item.transactionDate, item.amount, item.category, item.note || "", item.createdAt, item.updatedAt, JSON.stringify(receipts)];
}

export function createGoogleSheetsTransactionRepository({ fetchApi = fetch, createId = () => crypto.randomUUID(), now = () => new Date().toISOString() } = {}) {
  let connection = null;
  async function request(path, options = {}) {
    if (!connection) throw new FinanceSheetError("not-connected", "กรุณาเชื่อมต่อ Google ก่อนใช้งาน");
    const response = await fetchApi(`${SHEETS_URL}/${connection.spreadsheetId}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${connection.accessToken}`, "Content-Type": "application/json", ...options.headers },
    });
    if (response.status === 401 || response.status === 403) throw new FinanceSheetError("reconnect-required", "ต้องเชื่อมต่อ Google ใหม่");
    if (!response.ok) throw new FinanceSheetError("sheets-api-failure", "ไม่สามารถอ่านหรือบันทึกรายการได้");
    return response.status === 204 ? null : response.json();
  }
  const valuesPath = (range) => {
    if (!connection) throw new FinanceSheetError("not-connected", "กรุณาเชื่อมต่อ Google ก่อนใช้งาน");
    return `/values/${encodeURIComponent(`${quoteSheet(connection.sheetTitle)}!${range}`)}`;
  };
  async function readRows() { return (await request(`${valuesPath("A2:J")}?majorDimension=ROWS`)).values || []; }
  async function locate(id) {
    const rows = await readRows();
    const index = rows.findIndex((row) => row[0] === id);
    if (index < 0) throw new FinanceSheetError("not-found", "ไม่พบรายการที่ต้องการ");
    return { rowNumber: index + 2, item: rowToTransaction(rows[index]) };
  }
  return {
    async connect({ accessToken, spreadsheetId }) {
      if (!accessToken || !spreadsheetId) throw new FinanceSheetError("reconnect-required", "ต้องเชื่อมต่อ Google ใหม่");
      connection = { accessToken, spreadsheetId, sheetId: null, sheetTitle: null };
      const metadata = await request("?fields=sheets.properties(sheetId,title,index)");
      const sheet = [...(metadata.sheets || [])].sort((a, b) => a.properties.index - b.properties.index)[0];
      if (!sheet) throw new FinanceSheetError("missing-sheet", "ไม่พบแผ่นงานสำหรับรายการการเงิน");
      connection.sheetId = sheet.properties.sheetId; connection.sheetTitle = sheet.properties.title;
      const headerResult = await request(`${valuesPath("A1:J1")}?majorDimension=ROWS`);
      const current = headerResult.values?.[0] || [];
      const previousHeaders = TRANSACTION_HEADERS.slice(0, -1);
      if (current.length === 0) {
        await request(`${valuesPath("A1:J1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [[...TRANSACTION_HEADERS]] }) });
      } else if (current.length === previousHeaders.length && current.every((value, index) => value === previousHeaders[index])) {
        await request(`${valuesPath("J1:J1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [["receipts"]] }) });
      } else if (current.length !== TRANSACTION_HEADERS.length || current.some((value, index) => value !== TRANSACTION_HEADERS[index])) {
        throw new FinanceSheetError("schema-mismatch", "โครงสร้าง Finance Sheet ไม่ตรงกับที่ระบบรองรับ");
      }
    },
    disconnect() { connection = null; },
    async list() { return (await readRows()).filter((row) => row[0]).map(rowToTransaction); },
    async get(id) { try { return (await locate(id)).item; } catch (error) { if (error.code === "not-found") return null; throw error; } },
    async create(draft) {
      const timestamp = now();
      const item = { ...draft, id: createId(), createdAt: timestamp, updatedAt: timestamp, receipts: [] };
      await request(`${valuesPath("A:J")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: [transactionToRow(item)] }) });
      return item;
    },
    async update(id, draft) {
      const found = await locate(id);
      const item = { ...found.item, ...draft, id, createdAt: found.item.createdAt, updatedAt: now(), receipts: draft.receipts || found.item.receipts || [] };
      await request(`${valuesPath(`A${found.rowNumber}:J${found.rowNumber}`)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [transactionToRow(item)] }) });
      return item;
    },
    async delete(id) {
      const { rowNumber } = await locate(id);
      await request(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: connection.sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } } }] }) });
    },
  };
}
