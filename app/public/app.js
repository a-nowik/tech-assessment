'use strict';

// Account ABC from the assessment.
const EXAMPLE_PORTFOLIO = {
  totalAssets: 100000,
  holdings: [
    { symbol: 'IBM', targetPct: 20, currentPct: 10, price: 150 },
    { symbol: 'MSFT', targetPct: 20, currentPct: 20, price: 90 },
    { symbol: 'ORCL', targetPct: 20, currentPct: 30, price: 220 },
    { symbol: 'AAPL', targetPct: 20, currentPct: 20, price: 450 },
    { symbol: 'HD', targetPct: 20, currentPct: 20, price: 70 },
  ],
};

// Same rule as the API: percentages must add up to 100 +/- 0.01.
const PERCENT_TOLERANCE = 0.01;

const HOLDING_FIELDS = [
  { name: 'symbol', label: 'Security', type: 'text' },
  { name: 'targetPct', label: 'Target %', type: 'number' },
  { name: 'currentPct', label: 'Current %', type: 'number' },
  { name: 'price', label: 'Unit price', type: 'number' },
];

const form = document.getElementById('rebalance-form');
const totalAssetsInput = document.getElementById('total-assets');
const holdingsBody = document.getElementById('holdings-body');
const targetTotalCell = document.querySelector('[data-testid="target-total"]');
const currentTotalCell = document.querySelector('[data-testid="current-total"]');
const calculateButton = document.getElementById('calculate');
const errorsBox = document.getElementById('errors');
const errorsList = document.getElementById('errors-list');
const resultsSection = document.getElementById('results');
const resultsBody = document.getElementById('results-body');
const cashWarning = document.getElementById('cash-warning');

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const signedPercent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, signDisplay: 'exceptZero' });
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function toNumberOrNull(value) {
  return value.trim() === '' ? null : Number(value);
}

function addHoldingRow(holding = {}) {
  const row = document.createElement('tr');
  row.dataset.testid = 'holding-row';

  for (const field of HOLDING_FIELDS) {
    const input = document.createElement('input');
    input.type = field.type;
    input.name = field.name;
    input.setAttribute('aria-label', field.label);
    if (field.type === 'number') {
      input.step = 'any';
      input.min = '0';
    }
    input.value = holding[field.name] ?? '';

    const cell = document.createElement('td');
    cell.append(input);
    row.append(cell);
  }

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    row.remove();
    onInputChanged();
  });

  const actionCell = document.createElement('td');
  actionCell.append(removeButton);
  row.append(actionCell);

  holdingsBody.append(row);
}

function loadPortfolio(portfolio) {
  totalAssetsInput.value = portfolio.totalAssets;
  holdingsBody.replaceChildren();
  portfolio.holdings.forEach((holding) => addHoldingRow(holding));
  onInputChanged();
}

function readPortfolio() {
  return {
    totalAssets: toNumberOrNull(totalAssetsInput.value),
    holdings: [...holdingsBody.rows].map((row) => {
      const value = (name) => row.querySelector(`input[name="${name}"]`).value;
      return {
        symbol: value('symbol'),
        targetPct: toNumberOrNull(value('targetPct')),
        currentPct: toNumberOrNull(value('currentPct')),
        price: toNumberOrNull(value('price')),
      };
    }),
  };
}

function updatePercentTotals() {
  const { holdings } = readPortfolio();
  for (const [cell, field] of [[targetTotalCell, 'targetPct'], [currentTotalCell, 'currentPct']]) {
    const sum = holdings.reduce((total, holding) => total + (holding[field] || 0), 0);
    cell.textContent = `${percent.format(sum)}%`;
    // Rounding hides floating-point noise: 100.01 - 100 = 0.010000000000005116
    const difference = Math.round(Math.abs(sum - 100) * 1e6) / 1e6;
    cell.classList.toggle('invalid', difference > PERCENT_TOLERANCE);
  }
}

function hideOutput() {
  errorsBox.hidden = true;
  resultsSection.hidden = true;
}

// Any edit makes the previous calculation outdated, so it is hidden.
function onInputChanged() {
  updatePercentTotals();
  hideOutput();
}

function showErrors(errors) {
  errorsList.replaceChildren(
    ...errors.map((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      return item;
    }),
  );
  errorsBox.hidden = false;
}

function createCell(text, testId, className) {
  const cell = document.createElement('td');
  cell.textContent = text;
  cell.dataset.testid = testId;
  if (className) {
    cell.className = className;
  }
  return cell;
}

function showResults({ holdings, summary }) {
  resultsBody.replaceChildren(
    ...holdings.map((holding) => {
      const row = document.createElement('tr');
      row.dataset.testid = 'result-row';
      row.dataset.symbol = holding.symbol;
      row.append(
        createCell(holding.symbol, 'result-symbol'),
        createCell(percent.format(holding.targetPct), 'result-target'),
        createCell(percent.format(holding.currentPct), 'result-current'),
        createCell(signedPercent.format(holding.variancePct), 'result-variance'),
        createCell(money.format(holding.price), 'result-price'),
        createCell(holding.action, 'result-action', `action action-${holding.action.toLowerCase()}`),
        createCell(integer.format(holding.shares), 'result-shares'),
        createCell(money.format(holding.tradeValue), 'result-trade-value'),
        createCell(percent.format(holding.postTradePct), 'result-post-trade'),
        createCell(signedPercent.format(holding.residualVariancePct), 'result-residual'),
      );
      return row;
    }),
  );

  document.querySelector('[data-testid="total-buy"]').textContent = money.format(summary.totalBuyValue);
  document.querySelector('[data-testid="total-sell"]').textContent = money.format(summary.totalSellValue);
  document.querySelector('[data-testid="net-cash"]').textContent = signedMoney.format(summary.netCashFlow);
  cashWarning.hidden = summary.netCashFlow >= 0;
  resultsSection.hidden = false;
}

form.addEventListener('input', onInputChanged);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideOutput();
  calculateButton.disabled = true;

  try {
    const response = await fetch('/api/rebalance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readPortfolio()),
    });
    const body = await response.json();
    if (response.ok) {
      showResults(body);
    } else {
      showErrors(body.errors ?? [`Request failed with status ${response.status}`]);
    }
  } catch {
    showErrors(['Could not reach the server. Please try again.']);
  } finally {
    calculateButton.disabled = false;
  }
});

document.getElementById('add-row').addEventListener('click', () => {
  addHoldingRow();
  onInputChanged();
});

document.getElementById('load-example').addEventListener('click', () => loadPortfolio(EXAMPLE_PORTFOLIO));

loadPortfolio(EXAMPLE_PORTFOLIO);
