const BUCKET = "attachments";

export function createAttachmentStorage(client) {
  return {
    async upload(file) {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userData.user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await client.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      return { path };
    },
    async signedUrl(path, expiresIn = 3600) {
      if (!path) return null;
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    },
    async removeByPath(path) {
      if (!path) return;
      const { error } = await client.storage.from(BUCKET).remove([path]);
      if (error) throw error;
    },
  };
}
