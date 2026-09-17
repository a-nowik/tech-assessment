# tech-assessment

Technical assessment (QA): a simple **portfolio rebalancing app** and **Playwright tests** that check
how many shares of each security the app tells you to buy or sell.

## Project structure

```
app/                                # test app used as the system under test (see assumption 11)
  server.js                         #   HTTP server: static UI + POST /api/rebalance
  src/rebalance.js                  #   business logic: validation + trade calculation
  public/                           #   UI (index.html, app.js, styles.css)
e2e/                                # tests
  manual/manual.test.cases.md       #   manual test cases
  ui/rebalance.ui.spec.ts           #   automated UI tests (Playwright, Chromium)
  fixtures/rebalance.fixture.ts     #   `test` extended with the rebalancePage fixture
  pages/rebalance.page.ts           #   Page Object for the UI tests
  data/portfolios.ts                #   test cases with hand-calculated expected results
  utils/format.ts                   #   formats expected values the way the page shows them
playwright.config.ts
```

## How to run

Requirements: Node.js 20+.

```bash
npm install
npx playwright install chromium   # browser, only needed once

npm start                   # app at http://localhost:3000
npm test                    # all tests (starts the app automatically)
npm run report              # open the HTML report of the last run
```

Use a different port with `PORT=3100 npm test`.

## How the app works

Input: total assets and a list of securities with target %, current % and unit price.

For every security:

```
variance %  = current % - target %            (negative -> BUY, positive -> SELL)
trade value = |target % - current %| / 100 * total assets
shares      = trade value / unit price, rounded DOWN to a whole number
```

Account ABC from the assessment ($100,000):

| Security | Target % | Current % | Variance % | Unit price | Exact shares | **Output** |
|----------|---------:|----------:|-----------:|-----------:|-------------:|------------|
| IBM      | 20 | 10 | -10 | 150 | 66.67  | **BUY 66**  ($9,900) |
| MSFT     | 20 | 20 |   0 |  90 | 0      | **HOLD 0**  |
| ORCL     | 20 | 30 | +10 | 220 | 45.45  | **SELL 45** ($9,900) |
| AAPL     | 20 | 20 |   0 | 450 | 0      | **HOLD 0**  |
| HD       | 20 | 20 |   0 |  70 | 0      | **HOLD 0**  |

To get as close as possible to zero target variance: sell 45 ORCL and use the $9,900 to buy 66 IBM.
Because only whole shares can be traded, a small residual variance stays:
IBM ends at 19.9% (-0.1) and ORCL at 20.1% (+0.1). Exactly zero variance is reached only when the
trade value divides exactly by the unit price (see TC-03 in the manual test cases).

### How to calculate the variance

**1. Variance before the trade**

```
variance %  =  current %  -  target %          (negative -> BUY, positive -> SELL)
```

IBM: 10 - 20 = **-10**, ORCL: 30 - 20 = **+10**

**2. Variance after the trade** (the *Residual variance %* column in the app)

```
value before       = current % / 100 * total assets
trade value        = shares * unit price
value after        = value before + trade value     (BUY)
value after        = value before - trade value     (SELL)
post-trade %       = value after / total assets * 100
variance after %   = post-trade %  -  target %
```

|                    | IBM (BUY 66)                   | ORCL (SELL 45)                 |
|--------------------|--------------------------------|--------------------------------|
| Value before       | 10% * 100,000 = $10,000        | 30% * 100,000 = $30,000        |
| Trade value        | 66 * 150 = $9,900              | 45 * 220 = $9,900              |
| Value after        | 10,000 **+** 9,900 = $19,900   | 30,000 **-** 9,900 = $20,100   |
| Post-trade %       | 19,900 / 100,000 * 100 = 19.9% | 20,100 / 100,000 * 100 = 20.1% |
| **Variance after** | 19.9 - 20 = **-0.1**           | 20.1 - 20 = **+0.1**           |

Total assets do not change - a trade at the market price only swaps shares for cash or the other way.

Short form (same result; `+` for BUY, `-` for SELL):

```
variance after %  =  variance before %  ±  trade value / total assets * 100
```

IBM: -10 + 9,900 / 100,000 * 100 = **-0.1**, ORCL: +10 - 9.9 = **+0.1**

In dollars: `variance after $ = variance after % / 100 * total assets` - IBM: -0.1% * 100,000 = **-$100**,
less than the price of one share ($150), so it cannot be bought.

**3. Cash** (target 0%)

```
cash    =  total sells - total buys
cash %  =  cash / total assets * 100
```

Account ABC: 9,900 - 9,900 = **$0** -> **0%**

**4. Variance of the whole account** (to compare rounding options)

```
total variance    =  sum of |variance after %| of all securities  +  |cash %|
largest variance  =  max( |variance after %| of each security, |cash %| )
```

| Rounding            | IBM | ORCL | Cash          | IBM after | ORCL after | Cash % | Total variance | Largest |
|---------------------|----:|-----:|--------------:|----------:|-----------:|-------:|---------------:|--------:|
| **Down** (the app)  | 66  | 45   | $0            | -0.1      | +0.1       | 0      | **0.2**        | **0.1** |
| Nearest             | 67  | 45   | -$150         | +0.05     | +0.1       | -0.15  | 0.3            | 0.15    |

Rounding to the nearest share looks better for IBM alone, but it needs $150 the account does not have,
and the whole account ends up further from the target.

## Assumptions

1. **Whole shares only**, the share count is **rounded down**. The app never buys or sells more than the
   variance requires. Rounding to the nearest share would buy 67 IBM for $10,050 while selling ORCL
   brings only $9,900 - money the fully invested account does not have.
2. Because of (1), **exactly zero variance is usually not reachable**; the app shows the post-trade %
   and the residual variance instead.
3. If the trade is worth **less than one share**, the action is **HOLD** with 0 shares.
4. **100% vested** = everything is invested, there is no extra cash. Sells and buys happen at the given
   unit prices; no fees, taxes, lot sizes or price changes.
5. The app reports the **net cash flow** (sells - buys). A negative value means the sells do not cover
   the buys; the UI shows a warning but still lists the trades (the business decision is out of scope).
6. **Target % and current % must each add up to 100**, with a tolerance of 0.01 (e.g. 99.99 is accepted,
   99.98 is not). Each percentage must be between 0 and 100.
7. Total assets and unit price must be greater than 0.
8. Symbols are required and unique; they are trimmed and upper-cased (`" ibm "` -> `IBM`), so `IBM` and
   `ibm` count as duplicates.
9. Current % and target % are given as input; the app does not derive them from share counts.
10. Output order is the same as input order.
11. **The app in `app/` is a simplified test app** written only to demonstrate the test cases - we do not
    know how the real backend works. The automated tests therefore check the application through the
    UI only. Once the real backend is available, it is worth adding **API tests for server-side
    validation** (e.g. percentages not adding up to 100, a unit price of 0, missing or wrongly typed
    fields), because the server must reject invalid data on its own and cannot rely on the UI.

## Test approach

The tests validate the application's output: **the action and number of shares to buy or sell for each
security**, plus the variance left after the trades (to show when zero target variance is reached).

- **Manual test cases** (`e2e/manual/manual.test.cases.md`) - 12 cases in tables, input data -> expected
  output: standard cases (TC-01 - TC-04), corner cases (TC-05 - TC-07) and invalid input (TC-08 - TC-12).
- **UI tests** (`e2e/ui`) - all 12 cases automated with Playwright, data-driven: the action, shares and
  variance after trades read from the results table, or the error message for invalid input. They use
  the `rebalancePage` fixture and the `RebalancePage` Page Object.
- API tests are not included - see assumption 11.
- Automated test names start with the manual test case ID, and all test data lives in
  `e2e/data/portfolios.ts`.
- **Expected values are calculated by hand** (comments in `e2e/data/portfolios.ts`), not with the app
  code, so a bug in the app cannot hide itself by also changing the expected result.
