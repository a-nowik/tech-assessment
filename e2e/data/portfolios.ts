/**
 * Test cases for the rebalancing app (IDs match e2e/manual/manual.test.cases.md).
 *
 * Expected results are calculated by hand (see the comments) and NOT with the
 * application code, so the tests act as an independent oracle.
 *
 *   shares = |target% - current%| / 100 * totalAssets / price, rounded DOWN
 *   target% > current% -> BUY, target% < current% -> SELL, 0 shares -> HOLD
 *   variance after trades = post-trade % - target %
 */

export type Action = 'BUY' | 'SELL' | 'HOLD';

export interface Holding {
  symbol: string;
  targetPct: number;
  currentPct: number;
  price: number;
}

export interface Portfolio {
  totalAssets: number;
  holdings: Holding[];
}

export interface ExpectedTrade {
  symbol: string;
  action: Action;
  shares: number;
  /** Target variance left after the trades (0 = target reached). */
  residualVariancePct: number;
}

export interface Scenario {
  title: string;
  portfolio: Portfolio;
  expectedTrades: ExpectedTrade[];
}

export interface InvalidInputCase {
  title: string;
  portfolio: Portfolio;
  error: string;
}

const holding = (symbol: string, targetPct: number, currentPct: number, price: number): Holding => ({
  symbol,
  targetPct,
  currentPct,
  price,
});

const trade = (symbol: string, action: Action, shares: number, residualVariancePct = 0): ExpectedTrade => ({
  symbol,
  action,
  shares,
  residualVariancePct,
});

/** Account ABC from the assessment PDF. */
const accountAbc: Portfolio = {
  totalAssets: 100_000,
  holdings: [
    holding('IBM', 20, 10, 150),
    holding('MSFT', 20, 20, 90),
    holding('ORCL', 20, 30, 220),
    holding('AAPL', 20, 20, 450),
    holding('HD', 20, 20, 70),
  ],
};

// ---------------------------------------------------------------- standard cases

const accountAbcScenario: Scenario = {
  title: 'TC-01 account ABC from the assessment',
  portfolio: accountAbc,
  expectedTrades: [
    // 10% of 100,000 = 10,000 / 150 = 66.67 -> 66; after: 19,900 = 19.9% -> -0.1
    trade('IBM', 'BUY', 66, -0.1),
    trade('MSFT', 'HOLD', 0),
    // 10,000 / 220 = 45.45 -> 45; after: 30,000 - 9,900 = 20,100 = 20.1% -> +0.1
    trade('ORCL', 'SELL', 45, 0.1),
    trade('AAPL', 'HOLD', 0),
    trade('HD', 'HOLD', 0),
  ],
};

const severalTradesScenario: Scenario = {
  title: 'TC-02 several buys and sells at once',
  portfolio: {
    totalAssets: 200_000,
    holdings: [
      holding('AAA', 25, 15, 40),
      holding('BBB', 25, 20, 300),
      holding('CCC', 25, 35, 125),
      holding('DDD', 25, 30, 60),
    ],
  },
  expectedTrades: [
    // 10% of 200,000 = 20,000 / 40 = 500
    trade('AAA', 'BUY', 500),
    // 10,000 / 300 = 33.33 -> 33 (9,900); after: 49,900 = 24.95% -> -0.05
    trade('BBB', 'BUY', 33, -0.05),
    // 20,000 / 125 = 160
    trade('CCC', 'SELL', 160),
    // 10,000 / 60 = 166.67 -> 166 (9,960); after: 50,040 = 25.02% -> +0.02
    trade('DDD', 'SELL', 166, 0.02),
  ],
};

const zeroVarianceScenario: Scenario = {
  title: 'TC-03 zero target variance when trade values divide exactly by the prices',
  portfolio: {
    totalAssets: 100_000,
    holdings: [holding('AAA', 50, 40, 100), holding('BBB', 50, 60, 50)],
  },
  expectedTrades: [
    // 10,000 / 100 = 100 exactly -> 50% after the trade
    trade('AAA', 'BUY', 100),
    // 10,000 / 50 = 200 exactly -> 50% after the trade
    trade('BBB', 'SELL', 200),
  ],
};

const alreadyOnTargetScenario: Scenario = {
  title: 'TC-04 portfolio already on target',
  portfolio: {
    ...accountAbc,
    holdings: accountAbc.holdings.map((h) => ({ ...h, currentPct: h.targetPct })),
  },
  expectedTrades: ['IBM', 'MSFT', 'ORCL', 'AAPL', 'HD'].map((symbol) => trade(symbol, 'HOLD', 0)),
};

// ---------------------------------------------------------------- corner cases

const lessThanOneShareScenario: Scenario = {
  title: 'TC-05 trade worth less than one share',
  portfolio: {
    totalAssets: 10_000,
    holdings: [holding('AAA', 51, 50, 150), holding('BBB', 49, 50, 99)],
  },
  expectedTrades: [
    // 1% of 10,000 = 100 / 150 = 0.67 -> 0, variance stays -1
    trade('AAA', 'HOLD', 0, -1),
    // 100 / 99 = 1.01 -> 1 (99); after: 4,901 = 49.01% -> +0.01
    trade('BBB', 'SELL', 1, 0.01),
  ],
};

const wholePositionScenario: Scenario = {
  title: 'TC-06 target 0% sells the whole position, current 0% opens a new one',
  portfolio: {
    totalAssets: 50_000,
    holdings: [holding('OLD', 0, 10, 25), holding('KEEP', 90, 90, 80), holding('NEW', 10, 0, 50)],
  },
  expectedTrades: [
    // 10% of 50,000 = 5,000 / 25 = 200 -> 0% left
    trade('OLD', 'SELL', 200),
    trade('KEEP', 'HOLD', 0),
    // 5,000 / 50 = 100
    trade('NEW', 'BUY', 100),
  ],
};

const decimalPercentagesScenario: Scenario = {
  // In JavaScript (30 - 20.1) * 1000 / 100 / 9.9 = 9.999999999999998,
  // a naive Math.floor() would return 9 shares instead of 10.
  title: 'TC-07 decimal percentages do not lose a share to rounding errors',
  portfolio: {
    totalAssets: 1_000,
    holdings: [holding('AAA', 30, 20.1, 9.9), holding('BBB', 70, 79.9, 9.9)],
  },
  expectedTrades: [
    // 9.9% of 1,000 = 99 / 9.9 = 10
    trade('AAA', 'BUY', 10),
    trade('BBB', 'SELL', 10),
  ],
};

export const calculationScenarios: Scenario[] = [
  accountAbcScenario,
  severalTradesScenario,
  zeroVarianceScenario,
  alreadyOnTargetScenario,
  lessThanOneShareScenario,
  wholePositionScenario,
  decimalPercentagesScenario,
];

// ---------------------------------------------------------------- invalid input

/** Deep copy of account ABC with one holding changed. */
function accountAbcWith(index: number, changes: Partial<Holding>): Portfolio {
  const portfolio = structuredClone(accountAbc);
  Object.assign(portfolio.holdings[index], changes);
  return portfolio;
}

export const invalidInputCases: InvalidInputCase[] = [
  {
    // IBM target 20 -> 10
    title: 'TC-08 target % does not add up to 100',
    portfolio: accountAbcWith(0, { targetPct: 10 }),
    error: 'Target % must add up to 100 (currently 90)',
  },
  {
    // IBM current 10 -> 20
    title: 'TC-09 current % does not add up to 100',
    portfolio: accountAbcWith(0, { currentPct: 20 }),
    error: 'Current % must add up to 100 (currently 110)',
  },
  {
    // ORCL price 220 -> 0, the calculation would divide by zero
    title: 'TC-10 unit price is 0',
    portfolio: accountAbcWith(2, { price: 0 }),
    error: 'Row 3: unit price must be a number greater than 0',
  },
  {
    title: 'TC-11 total assets is 0',
    portfolio: { ...accountAbc, totalAssets: 0 },
    error: 'Total assets must be a number greater than 0',
  },
  {
    title: 'TC-12 portfolio without securities',
    portfolio: { totalAssets: 100_000, holdings: [] },
    error: 'Portfolio must contain at least one security',
  },
];
