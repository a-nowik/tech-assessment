# Manual Test Cases – Portfolio Rebalancer

Test cases for the number of shares to buy or sell for each security. The formulas, the rounding rule
and the assumptions are described in the [README](../../README.md#how-the-app-works).

## How to execute

1. Start the app - see [README, step 7](../../README.md#7-start-the-server-for-manual-testing).
2. Enter the input data. Account ABC is loaded by default; for other portfolios use **Remove** and
   **Add security**.
3. Click **Calculate**.
4. Compare the **Action**, **Shares** and **Residual variance %** columns with the expected output.

Input data notation: `SYMBOL target % / current % / unit price`.

## Standard cases

| ID | Test case | Input data | Expected output – shares to buy/sell | Variance after trades | Automated |
|----|-----------|------------|--------------------------------------|-----------------------|-----------|
| TC-01 | Account ABC from the assessment | Total assets $100,000<br>IBM 20 / 10 / $150<br>MSFT 20 / 20 / $90<br>ORCL 20 / 30 / $220<br>AAPL 20 / 20 / $450<br>HD 20 / 20 / $70 | IBM **BUY 66** (10,000 / 150 = 66.67)<br>MSFT **HOLD 0**<br>ORCL **SELL 45** (10,000 / 220 = 45.45)<br>AAPL **HOLD 0**<br>HD **HOLD 0** | IBM -0.1<br>ORCL +0.1<br>others 0<br>(zero not reachable with whole shares) | UI |
| TC-02 | Several buys and sells at once | Total assets $200,000<br>AAA 25 / 15 / $40<br>BBB 25 / 20 / $300<br>CCC 25 / 35 / $125<br>DDD 25 / 30 / $60 | AAA **BUY 500** (20,000 / 40)<br>BBB **BUY 33** (10,000 / 300 = 33.33)<br>CCC **SELL 160** (20,000 / 125)<br>DDD **SELL 166** (10,000 / 60 = 166.67) | AAA 0<br>BBB -0.05<br>CCC 0<br>DDD +0.02 | UI |
| TC-03 | Zero target variance | Total assets $100,000<br>AAA 50 / 40 / $100<br>BBB 50 / 60 / $50 | AAA **BUY 100** (10,000 / 100)<br>BBB **SELL 200** (10,000 / 50) | 0 for all<br>(target reached) | UI |
| TC-04 | Portfolio already on target | Account ABC with current % = 20 for every security | All securities **HOLD 0** | 0 for all | UI |

## Corner cases

| ID | Test case | Input data | Expected output – shares to buy/sell | Variance after trades | Automated |
|----|-----------|------------|--------------------------------------|-----------------------|-----------|
| TC-05 | Trade worth less than one share | Total assets $10,000<br>AAA 51 / 50 / $150<br>BBB 49 / 50 / $99 | AAA **HOLD 0** (100 / 150 = 0.67)<br>BBB **SELL 1** (100 / 99 = 1.01) | AAA -1<br>BBB +0.01 | UI |
| TC-06 | Target 0% sells the whole position, current 0% opens a new one | Total assets $50,000<br>OLD 0 / 10 / $25<br>KEEP 90 / 90 / $80<br>NEW 10 / 0 / $50 | OLD **SELL 200** (5,000 / 25)<br>KEEP **HOLD 0**<br>NEW **BUY 100** (5,000 / 50) | 0 for all | UI |
| TC-07 | Decimal percentages – no share lost to rounding errors | Total assets $1,000<br>AAA 30 / 20.1 / $9.9<br>BBB 70 / 79.9 / $9.9 | AAA **BUY 10** (99 / 9.9 = 10, not 9)<br>BBB **SELL 10** (99 / 9.9 = 10) | 0 for all | UI |

TC-07: in JavaScript `(30 - 20.1) * 1000 / 100 / 9.9` gives `9.999999999999998`; a simple round-down
would return 9 shares instead of 10.

## Invalid input

The calculation must not run – an error is shown and no shares are returned.

| ID | Test case | Input data | Expected output | Automated |
|----|-----------|------------|-----------------|-----------|
| TC-08 | Target % does not add up to 100 | Account ABC, IBM target % = **10** | *Target % must add up to 100 (currently 90)* | UI |
| TC-09 | Current % does not add up to 100 | Account ABC, IBM current % = **20** | *Current % must add up to 100 (currently 110)* | UI |
| TC-10 | Unit price is 0 (division by zero) | Account ABC, ORCL unit price = **0** | *Row 3: unit price must be a number greater than 0* | UI |
| TC-11 | Total assets is 0 | Account ABC, total assets = **0** | *Total assets must be a number greater than 0* | UI |
| TC-12 | Portfolio without securities | Total assets $100,000, all rows removed | *Portfolio must contain at least one security* | UI |
