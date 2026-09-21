export const FINANCE_GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export class GoogleAuthorizationError extends Error {
  constructor(code, message) { super(message); this.name = "GoogleAuthorizationError"; this.code = code; }
}

export function createGoogleAuthorization({ clientId, googleApi = () => globalThis.google } = {}) {
  return {
    async authorize() {
      if (!clientId || clientId === "YOUR_GOOGLE_OAUTH_WEB_CLIENT_ID") {
        throw new GoogleAuthorizationError("missing-config", "ยังไม่ได้ตั้งค่า Google OAuth Client ID");
      }

      const google = googleApi();
      if (!google?.accounts?.oauth2?.initTokenClient) {
        throw new GoogleAuthorizationError("gis-unavailable", "ไม่สามารถโหลดระบบเชื่อมต่อ Google ได้");
      }

      return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: FINANCE_GOOGLE_SCOPE,
          callback(response) {
            if (response?.error || !response?.access_token) {
              reject(new GoogleAuthorizationError(
                response?.error || "authorization-cancelled",
                "ไม่ได้รับอนุญาตให้เชื่อมต่อ Google",
              ));
              return;
            }
            resolve(response.access_token);
          },
          error_callback() {
            reject(new GoogleAuthorizationError("popup-closed", "การเชื่อมต่อ Google ถูกยกเลิก"));
          },
        });

        // Empty prompt reuses an existing Google grant/session when possible.
        // It asks for consent only when the app actually needs it.
        client.requestAccessToken({ prompt: "" });
      });
    },

    clear() {},
  };
}
