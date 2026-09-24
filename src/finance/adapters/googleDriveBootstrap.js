const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const MARKERS = Object.freeze({ product: "family-task-finance", schemaVersion: "1" });
const RESOURCE_NAMES = Object.freeze({
  folder: "งานบ้านของเรา - Finance",
  sheet: "งานบ้านของเรา - Finance Transactions",
});

export class FinanceBootstrapError extends Error {
  constructor(code, message) { super(message); this.name = "FinanceBootstrapError"; this.code = code; }
}

function markerQuery(resource) { return `appProperties has { key='product' and value='${MARKERS.product}' } and appProperties has { key='resource' and value='${resource}' } and trashed = false`; }

function nameQuery(name, mimeType, parentId) {
  const escapedName = String(name).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  let query = `name = '${escapedName}' and mimeType = '${mimeType}' and trashed = false`;
  if (parentId) query += ` and '${parentId}' in parents`;
  return query;
}

export function createGoogleDriveBootstrap({ fetchApi = fetch } = {}) {
  async function request(accessToken, url, options = {}) {
    const response = await fetchApi(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...options.headers } });
    if (response.status === 401) throw new FinanceBootstrapError("reconnect-required", "ต้องเชื่อมต่อ Google ใหม่");
    if (!response.ok) throw new FinanceBootstrapError("drive-api-failure", "เกิดข้อผิดพลาดในการเตรียมพื้นที่การเงิน");
    return response.json();
  }

  async function list(accessToken, query) {
    const params = new URLSearchParams({ q: query, spaces: "drive", fields: "files(id,name,mimeType,parents,appProperties)", pageSize: "10" });
    return (await request(accessToken, `${DRIVE_FILES_URL}?${params}`)).files || [];
  }

  const create = (accessToken, metadata) => request(accessToken, `${DRIVE_FILES_URL}?fields=id,name,mimeType,parents,appProperties`, { method: "POST", body: JSON.stringify(metadata) });

  const updateMetadata = (accessToken, fileId, metadata) => request(
    accessToken,
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents,appProperties`,
    { method: "PATCH", body: JSON.stringify(metadata) },
  );

  async function oneOrCreate({ accessToken, query, migrationQuery, metadata, duplicateCode }) {
    const matches = await list(accessToken, query);
    if (matches.length > 1) throw new FinanceBootstrapError(duplicateCode, "พบพื้นที่การเงินซ้ำ กรุณาตรวจสอบก่อนดำเนินการต่อ");
    if (matches.length === 1) return { file: matches[0], reused: true };

    const migrationMatches = await list(accessToken, migrationQuery);
    if (migrationMatches.length > 1) throw new FinanceBootstrapError(duplicateCode, "พบพื้นที่การเงินซ้ำ กรุณาตรวจสอบก่อนดำเนินการต่อ");
    if (migrationMatches.length === 1) {
      const migrated = await updateMetadata(accessToken, migrationMatches[0].id, { appProperties: metadata.appProperties });
      return { file: migrated, reused: true };
    }

    return { file: await create(accessToken, metadata), reused: false };
  }

  return { async prepare(accessToken) {
    if (!accessToken) throw new FinanceBootstrapError("reconnect-required", "ต้องเชื่อมต่อ Google ใหม่");

    const folderMetadata = {
      name: RESOURCE_NAMES.folder,
      mimeType: FOLDER_MIME,
      appProperties: { ...MARKERS, resource: "root-folder" },
    };
    const folder = await oneOrCreate({
      accessToken,
      query: `${markerQuery("root-folder")} and mimeType = '${FOLDER_MIME}'`,
      migrationQuery: nameQuery(RESOURCE_NAMES.folder, FOLDER_MIME),
      duplicateCode: "duplicate-folder",
      metadata: folderMetadata,
    });

    const sheetMetadata = {
      name: RESOURCE_NAMES.sheet,
      mimeType: SHEET_MIME,
      parents: [folder.file.id],
      appProperties: { ...MARKERS, resource: "transactions-sheet" },
    };
    const sheet = await oneOrCreate({
      accessToken,
      query: `${markerQuery("transactions-sheet")} and mimeType = '${SHEET_MIME}' and '${folder.file.id}' in parents`,
      migrationQuery: nameQuery(RESOURCE_NAMES.sheet, SHEET_MIME, folder.file.id),
      duplicateCode: "duplicate-sheet",
      metadata: sheetMetadata,
    });

    return {
      folderReused: folder.reused,
      sheetReused: sheet.reused,
      folderId: folder.file.id,
      folderName: folder.file.name,
      sheetName: sheet.file.name,
      spreadsheetId: sheet.file.id,
    };
  } };
}
