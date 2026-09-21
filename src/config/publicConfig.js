// These values are intentionally browser-visible publishable configuration.
// Each deployed copy must provide its own project values through environment variables.
// Never place service_role keys, OAuth client secrets, VAPID private keys, access tokens,
// refresh tokens, private keys, or other secrets here or in VITE_* variables.
function requiredPublicEnv(name, value) {
  if (!value) throw new Error(`Missing required public configuration: ${name}`);
  return value;
}

export const publicConfig = Object.freeze({
  supabaseUrl: requiredPublicEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: requiredPublicEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || "",
});
