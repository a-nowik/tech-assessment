import type { Locator, Page } from '@playwright/test';
import type { Holding, Portfolio } from '../data/portfolios';

const HOLDING_LABELS: Record<keyof Holding, string> = {
  symbol: 'Security',
  targetPct: 'Target %',
  currentPct: 'Current %',
  price: 'Unit price',
};

/** Page Object for the Portfolio Rebalancer screen. */
export class RebalancePage {
  readonly totalAssets: Locator;
  readonly holdingRows: Locator;
  readonly addSecurityButton: Locator;
  readonly calculateButton: Locator;
  readonly errors: Locator;
  readonly results: Locator;
  readonly tradeRows: Locator;

  constructor(readonly page: Page) {
    this.totalAssets = page.getByLabel('Total assets ($)');
    this.holdingRows = page.getByTestId('holding-row');
    this.addSecurityButton = page.getByRole('button', { name: 'Add security' });
    this.calculateButton = page.getByRole('button', { name: 'Calculate' });
    this.errors = page.getByRole('alert');
    this.results = page.getByRole('region', { name: 'Trades' });
    this.tradeRows = page.getByTestId('result-row');
  }

  async goto() {
    await this.page.goto('/');
  }

  async fillHolding(index: number, holding: Holding) {
    const row = this.holdingRows.nth(index);
    for (const [field, label] of Object.entries(HOLDING_LABELS) as [keyof Holding, string][]) {
      await row.getByLabel(label).fill(String(holding[field]));
    }
  }

  /** Replaces the whole form content with the given portfolio. */
  async fillPortfolio(portfolio: Portfolio) {
    await this.totalAssets.fill(String(portfolio.totalAssets));
    while ((await this.holdingRows.count()) > 0) {
      await this.holdingRows.first().getByRole('button', { name: 'Remove' }).click();
    }
    for (const [index, holding] of portfolio.holdings.entries()) {
      await this.addSecurityButton.click();
      await this.fillHolding(index, holding);
    }
  }

  async calculate() {
    await this.calculateButton.click();
  }
}
