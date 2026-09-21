import { describe, expect, it, vi } from "vitest";
import { createTaskService } from "./taskService.js";

function setup() {
  const repository = {
    list: vi.fn(),
    subscribe: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  };
  const attachmentStorage = {
    upload: vi.fn(),
    signedUrl: vi.fn(),
    removeByPath: vi.fn(),
  };
  return { repository, attachmentStorage, service: createTaskService({ repository, attachmentStorage }) };
}

describe("task service", () => {
  it("creates a task without exposing repository details to the UI", async () => {
    const { repository, service } = setup();
    await service.save({ payload: { title: "ล้างจาน" } });
    expect(repository.create).toHaveBeenCalledWith({ title: "ล้างจาน" });
  });

  it("rolls back a newly uploaded file when database save fails", async () => {
    const { repository, attachmentStorage, service } = setup();
    const error = new Error("database failed");
    attachmentStorage.upload.mockResolvedValue({ path: "user/new.jpg" });
    repository.update.mockRejectedValue(error);
    await expect(service.save({ id: "1", payload: {}, file: { name: "new.jpg" } })).rejects.toThrow(error);
    expect(attachmentStorage.removeByPath).toHaveBeenCalledWith("user/new.jpg");
  });

  it("stores the private attachment path and removes the replaced file", async () => {
    const { repository, attachmentStorage, service } = setup();
    attachmentStorage.upload.mockResolvedValue({ path: "user/new.jpg" });
    const payload = {};
    await service.save({
      id: "1",
      payload,
      file: { name: "new.jpg" },
      previousAttachmentPath: "user/old.jpg",
    });
    expect(repository.update).toHaveBeenCalledWith("1", { attachment_path: "user/new.jpg" });
    expect(attachmentStorage.removeByPath).toHaveBeenCalledWith("user/old.jpg");
  });

  it("deletes the task before best-effort attachment cleanup", async () => {
    const { repository, attachmentStorage, service } = setup();
    attachmentStorage.removeByPath.mockRejectedValue(new Error("storage failed"));
    await expect(service.delete({ id: "1", attachment_path: "user/old.jpg" })).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith("1");
  });

  it("returns a signed URL for an attachment path", async () => {
    const { attachmentStorage, service } = setup();
    attachmentStorage.signedUrl.mockResolvedValue("https://signed.example/file");
    await expect(service.attachmentUrl("user/file.pdf")).resolves.toBe("https://signed.example/file");
  });
});
