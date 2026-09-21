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
    removeByPath: vi.fn(),
    removeByPublicUrl: vi.fn(),
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
    attachmentStorage.upload.mockResolvedValue({ path: "new.jpg", publicUrl: "https://example/new.jpg" });
    repository.update.mockRejectedValue(error);
    await expect(service.save({ id: "1", payload: {}, file: { name: "new.jpg" } })).rejects.toThrow(error);
    expect(attachmentStorage.removeByPath).toHaveBeenCalledWith("new.jpg");
  });

  it("removes the replaced attachment after a successful save", async () => {
    const { attachmentStorage, service } = setup();
    attachmentStorage.upload.mockResolvedValue({ path: "new.jpg", publicUrl: "https://example/new.jpg" });
    await service.save({
      id: "1",
      payload: {},
      file: { name: "new.jpg" },
      previousAttachmentUrl: "https://example/old.jpg",
    });
    expect(attachmentStorage.removeByPublicUrl).toHaveBeenCalledWith("https://example/old.jpg");
  });

  it("deletes the task before best-effort attachment cleanup", async () => {
    const { repository, attachmentStorage, service } = setup();
    attachmentStorage.removeByPublicUrl.mockRejectedValue(new Error("storage failed"));
    await expect(service.delete({ id: "1", attachment_url: "https://example/old.jpg" })).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith("1");
  });
});
