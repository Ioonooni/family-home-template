export function assertFinanceResourceBootstrap(bootstrap) {
  if (typeof bootstrap?.prepare !== "function") throw new TypeError("FinanceResourceBootstrap.prepare is required");
  return bootstrap;
}
