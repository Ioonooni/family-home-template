import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "./authService.js";

function setup() {
  const unsubscribe = vi.fn();
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "1" } } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: "1" } } }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: "1" }, session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe } } }),
    },
  };
  return { client, unsubscribe, service: createAuthService(client) };
}

describe("auth service", () => {
  it("signs in with email and password", async () => {
    const { client, service } = setup();
    await service.signIn("person@example.com", "secret12");
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: "person@example.com", password: "secret12" });
  });

  it("exposes current session", async () => {
    const { service } = setup();
    await expect(service.getSession()).resolves.toEqual({ user: { id: "1" } });
  });

  it("returns an unsubscribe callback", () => {
    const { unsubscribe, service } = setup();
    const stop = service.subscribe(() => {});
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
