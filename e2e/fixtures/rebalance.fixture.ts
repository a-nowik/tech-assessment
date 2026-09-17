import { test as base } from '@playwright/test';
import { RebalancePage } from '../pages/rebalance.page';

type RebalanceFixtures = {
  /** Rebalancer page, already opened. A new instance for every test. */
  rebalancePage: RebalancePage;
};

/** Playwright `test` extended with the `rebalancePage` fixture. */
export const test = base.extend<RebalanceFixtures>({
  rebalancePage: async ({ page }, use) => {
    const rebalancePage = new RebalancePage(page);
    await rebalancePage.goto();
    await use(rebalancePage);
  },
});

export { expect } from '@playwright/test';
