async function bestEffort(action) {
  try {
    await action();
  } catch {
    // Cleanup failure must not hide the primary database result.
  }
}

export function createTaskService({ repository, attachmentStorage }) {
  return {
    list: () => repository.list(),
    subscribe: (onChange) => repository.subscribe(onChange),
    updateStatus: (id, status) => repository.updateStatus(id, status),
    attachmentUrl: (path) => attachmentStorage.signedUrl(path),
    async save({ id, payload, file, previousAttachmentPath, removeAttachment }) {
      let uploaded = null;
      if (file) {
        uploaded = await attachmentStorage.upload(file);
        payload.attachment_path = uploaded.path;
      } else if (removeAttachment) {
        payload.attachment_path = null;
      }

      try {
        if (id) await repository.update(id, payload);
        else await repository.create(payload);
      } catch (error) {
        if (uploaded) await bestEffort(() => attachmentStorage.removeByPath(uploaded.path));
        throw error;
      }

      if (previousAttachmentPath && (uploaded || removeAttachment)) {
        await bestEffort(() => attachmentStorage.removeByPath(previousAttachmentPath));
      }
    },
    async delete(task) {
      await repository.delete(task.id);
      if (task.attachment_path) {
        await bestEffort(() => attachmentStorage.removeByPath(task.attachment_path));
      }
    },
  };
}
