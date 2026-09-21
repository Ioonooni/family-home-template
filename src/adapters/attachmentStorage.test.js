import { describe, expect, it } from "vitest";
import { pathFromPublicUrl } from "./attachmentStorage.js";

describe("attachment path", () => {
  it("extracts a bucket-relative path", () => {
    expect(pathFromPublicUrl("https://example.supabase.co/storage/v1/object/public/attachments/folder/a.pdf")).toBe("folder/a.pdf");
  });

  it("rejects unrelated URLs", () => {
    expect(pathFromPublicUrl("https://example.com/file.pdf")).toBeNull();
  });
});
