/**
 * Finance persistence port. Adapters must implement list/get/create/update/delete.
 * The UI and application layers must never import Supabase or provider-specific code.
 */
export function assertTransactionRepository(repository) {
  for (const method of ["list", "get", "create", "update", "delete"]) {
    if (typeof repository?.[method] !== "function") throw new TypeError(`TransactionRepository.${method} is required`);
  }
  return repository;
}
