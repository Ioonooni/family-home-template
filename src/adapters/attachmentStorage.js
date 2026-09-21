const BUCKET = "attachments";

function pathFromPublicUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    return index < 0 ? null : decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export function createAttachmentStorage(client) {
  return {
    async upload(file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error } = await client.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      const { data } = client.storage.from(BUCKET).getPublicUrl(path);
      return { path, publicUrl: data.publicUrl };
    },
    async removeByPath(path) {
      if (!path) return;
      const { error } = await client.storage.from(BUCKET).remove([path]);
      if (error) throw error;
    },
    async removeByPublicUrl(url) {
      const path = pathFromPublicUrl(url);
      if (path) await this.removeByPath(path);
    },
  };
}

export { pathFromPublicUrl };
