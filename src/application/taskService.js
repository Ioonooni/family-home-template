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
    async save({ id, payload, file, previousAttachmentUrl, removeAttachment }) {
      let uploaded = null;
      if (file) {
        uploaded = await attachmentStorage.upload(file);
        payload.attachment_url = uploaded.publicUrl;
      } else if (removeAttachment) {
        payload.attachment_url = null;
      }

      try {
        if (id) await repository.update(id, payload);
        else await repository.create(payload);
      } catch (error) {
        if (uploaded) await bestEffort(() => attachmentStorage.removeByPath(uploaded.path));
        throw error;
      }

      if (previousAttachmentUrl && (uploaded || removeAttachment)) {
        await bestEffort(() => attachmentStorage.removeByPublicUrl(previousAttachmentUrl));
      }
    },
    async delete(task) {
      await repository.delete(task.id);
      if (task.attachment_url) {
        await bestEffort(() => attachmentStorage.removeByPublicUrl(task.attachment_url));
      }
    },
  };
}
