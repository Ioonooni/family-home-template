import { describe, expect, it, vi } from "vitest";
import { FINANCE_GOOGLE_SCOPE, createGoogleAuthorization } from "./googleAuthorization.js";

describe("Google authorization", () => {
  it("reuses an existing grant when possible and keeps the token out of browser storage", async () => {
    let options;
    let requestOptions;
    const storageWrite = vi.fn();
    vi.stubGlobal("localStorage", { setItem: storageWrite });
    vi.stubGlobal("sessionStorage", { setItem: storageWrite });

    const authorization = createGoogleAuthorization({
      clientId: "browser-client-id",
      googleApi: () => ({
        accounts: {
          oauth2: {
            initTokenClient(value) {
              options = value;
              return {
                requestAccessToken(valueOverride) {
                  requestOptions = valueOverride;
                  options.callback({ access_token: "memory-token" });
                },
              };
            },
          },
        },
      }),
    });

    await expect(authorization.authorize()).resolves.toBe("memory-token");
    expect(options.scope).toBe(FINANCE_GOOGLE_SCOPE);
    expect(requestOptions).toEqual({ prompt: "" });
    expect(storageWrite).not.toHaveBeenCalled();

    authorization.clear();
    vi.unstubAllGlobals();
  });

  it("rejects missing configuration", async () => {
    await expect(createGoogleAuthorization({ clientId: "" }).authorize())
      .rejects.toMatchObject({ code: "missing-config" });
  });

  it("reports unavailable GIS", async () => {
    await expect(createGoogleAuthorization({
      clientId: "browser-client-id",
      googleApi: () => undefined,
    }).authorize()).rejects.toMatchObject({ code: "gis-unavailable" });
  });
});
