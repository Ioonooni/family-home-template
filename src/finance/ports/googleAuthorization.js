export function assertGoogleAuthorization(authorization) {
  if (typeof authorization?.authorize !== "function" || typeof authorization?.clear !== "function") throw new TypeError("GoogleAuthorization authorize/clear are required");
  return authorization;
}
