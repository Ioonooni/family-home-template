import { assertFinanceResourceBootstrap } from "../ports/financeResourceBootstrap.js";
import { assertGoogleAuthorization } from "../ports/googleAuthorization.js";

export function createFinanceSetupService({ authorization, resourceBootstrap, transactionRepository, receiptStorage }) {
  assertGoogleAuthorization(authorization); assertFinanceResourceBootstrap(resourceBootstrap);
  return {
    async connect() { try {
      const accessToken = await authorization.authorize();
      const resources = await resourceBootstrap.prepare(accessToken);
      if (transactionRepository?.connect) await transactionRepository.connect({ accessToken, spreadsheetId: resources.spreadsheetId });
      if (receiptStorage?.connect) receiptStorage.connect({ accessToken, folderId: resources.folderId });
      return resources;
    } catch (error) {
      authorization.clear();
      transactionRepository?.disconnect?.();
      receiptStorage?.disconnect?.();
      throw error;
    } },
    disconnect() {
      authorization.clear();
      transactionRepository?.disconnect?.();
      receiptStorage?.disconnect?.();
    },
  };
}
