import { test, expect } from '../fixtures/rebalance.fixture';
import { calculationScenarios, invalidInputCases } from '../data/portfolios';
import { formatShares, formatSigned } from '../utils/format';

test.describe('Rebalancer UI - shares to buy/sell for each security', () => {
  for (const scenario of calculationScenarios) {
    test(scenario.title, async ({ rebalancePage }) => {
      await rebalancePage.fillPortfolio(scenario.portfolio);
      await rebalancePage.calculate();

      await expect(rebalancePage.tradeRows).toHaveCount(scenario.expectedTrades.length);
      for (const [index, trade] of scenario.expectedTrades.entries()) {
        const row = rebalancePage.tradeRows.nth(index);
        await expect(row.getByTestId('result-symbol')).toHaveText(trade.symbol);
        await expect(row.getByTestId('result-action')).toHaveText(trade.action);
        await expect(row.getByTestId('result-shares')).toHaveText(formatShares(trade.shares));
        await expect(row.getByTestId('result-residual')).toHaveText(formatSigned(trade.residualVariancePct));
      }
    });
  }
});

test.describe('Rebalancer UI - invalid input', () => {
  for (const invalidCase of invalidInputCases) {
    test(invalidCase.title, async ({ rebalancePage }) => {
      await rebalancePage.fillPortfolio(invalidCase.portfolio);
      await rebalancePage.calculate();

      await expect(rebalancePage.errors.getByRole('listitem')).toHaveText([invalidCase.error]);
      await expect(rebalancePage.results).toBeHidden();
    });
  }
});
