import { describe, expect, it } from "vitest";
import { createGoogleDriveBootstrap } from "./googleDriveBootstrap.js";

function fakeDrive(initial = []) {
  const files = structuredClone(initial); let sequence = 1;
  const fetchApi = async (url, options = {}) => {
    const parsed = new URL(url);

    if (options.method === "POST") {
      const file = { id: `created-${sequence++}`, ...JSON.parse(options.body) };
      files.push(file);
      return { ok: true, status: 200, json: async () => structuredClone(file) };
    }

    if (options.method === "PATCH") {
      const id = decodeURIComponent(parsed.pathname.split("/").pop());
      const file = files.find((item) => item.id === id);
      Object.assign(file, JSON.parse(options.body));
      return { ok: true, status: 200, json: async () => structuredClone(file) };
    }

    const query = parsed.searchParams.get("q") || "";
    const product = query.match(/key='product' and value='([^']+)'/)?.[1];
    const resource = query.match(/key='resource' and value='([^']+)'/)?.[1];
    const name = query.match(/name = '([^']+)'/)?.[1];
    const mimeType = query.match(/mimeType = '([^']+)'/)?.[1];
    const parent = query.match(/'([^']+)' in parents/)?.[1];

    const matches = files.filter((file) =>
      (!product || file.appProperties?.product === product) &&
      (!resource || file.appProperties?.resource === resource) &&
      (!name || file.name === name) &&
      (!mimeType || file.mimeType === mimeType) &&
      (!parent || file.parents?.includes(parent))
    );
    return { ok: true, status: 200, json: async () => ({ files: structuredClone(matches) }) };
  };
  return { files, fetchApi };
}

const folder = {
  id: "folder-1",
  name: "งานบ้านของเรา - Finance",
  mimeType: "application/vnd.google-apps.folder",
  appProperties: { product: "family-task-finance", resource: "root-folder", schemaVersion: "1" },
};
const sheet = {
  id: "sheet-1",
  name: "งานบ้านของเรา - Finance Transactions",
  mimeType: "application/vnd.google-apps.spreadsheet",
  parents: ["folder-1"],
  appProperties: { product: "family-task-finance", resource: "transactions-sheet", schemaVersion: "1" },
};

describe("Google Drive Finance bootstrap", () => {
  it("reuses existing tagged resources", async () => expect(await createGoogleDriveBootstrap({ fetchApi: fakeDrive([folder, sheet]).fetchApi }).prepare("token")).toMatchObject({ folderReused: true, sheetReused: true }));

  it("adopts existing named resources and retags them without creating duplicates", async () => {
    const legacyFolder = { ...folder, appProperties: { product: "legacy", resource: "root-folder", schemaVersion: "1" } };
    const legacySheet = { ...sheet, appProperties: { product: "legacy", resource: "transactions-sheet", schemaVersion: "1" } };
    const drive = fakeDrive([legacyFolder, legacySheet]);
    await expect(createGoogleDriveBootstrap({ fetchApi: drive.fetchApi }).prepare("token")).resolves.toMatchObject({ folderReused: true, sheetReused: true });
    expect(drive.files).toHaveLength(2);
    expect(drive.files.every((file) => file.appProperties.product === "family-task-finance")).toBe(true);
  });

  it("creates a missing folder once and a sheet inside it", async () => {
    const drive = fakeDrive();
    const result = await createGoogleDriveBootstrap({ fetchApi: drive.fetchApi }).prepare("token");
    expect(result).toMatchObject({ folderReused: false, sheetReused: false });
    expect(drive.files.find((file) => file.appProperties.resource === "transactions-sheet").parents).toEqual(["created-1"]);
  });

  it("is idempotent on repeated bootstrap", async () => {
    const drive = fakeDrive();
    const bootstrap = createGoogleDriveBootstrap({ fetchApi: drive.fetchApi });
    await bootstrap.prepare("token");
    expect(await bootstrap.prepare("token")).toMatchObject({ folderReused: true, sheetReused: true });
    expect(drive.files).toHaveLength(2);
  });

  it("stops on duplicate tagged folders", async () => {
    const drive = fakeDrive([folder, { ...folder, id: "folder-2" }]);
    await expect(createGoogleDriveBootstrap({ fetchApi: drive.fetchApi }).prepare("token")).rejects.toMatchObject({ code: "duplicate-folder" });
  });

  it("stops on duplicate tagged sheets", async () => {
    const drive = fakeDrive([folder, sheet, { ...sheet, id: "sheet-2" }]);
    await expect(createGoogleDriveBootstrap({ fetchApi: drive.fetchApi }).prepare("token")).rejects.toMatchObject({ code: "duplicate-sheet" });
  });
});
