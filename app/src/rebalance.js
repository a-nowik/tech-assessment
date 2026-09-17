'use strict';

/**
 * Portfolio rebalancing logic.
 *
 * Business rules (see README "Assumptions"):
 * - variance % = current % - target %  (negative -> BUY, positive -> SELL)
 * - trade value = |target % - current %| / 100 * total assets
 * - only whole shares are traded and the share count is rounded DOWN,
 *   so the app never buys or sells more than the variance requires
 */

// Allowed difference between the sum of percentages and 100.
const PERCENT_TOLERANCE = 0.01;
// Absorbs floating-point noise, e.g. 9.999999999999998 must count as 10 shares.
const FLOAT_EPSILON = 1e-9;

function round(value, decimals) {
  const factor = 10 ** decimals;
  // `|| 0` turns -0 into 0
  return Math.round((value + Number.EPSILON) * factor) / factor || 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSymbol(symbol) {
  return typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
}

function checkPercentSum(holdings, field, label, errors) {
  const sum = holdings.reduce((total, holding) => total + holding[field], 0);
  if (round(Math.abs(sum - 100), 6) > PERCENT_TOLERANCE) {
    errors.push(`${label} must add up to 100 (currently ${round(sum, 4)})`);
  }
}

/**
 * Returns a list of validation errors; an empty list means the input is valid.
 */
function validatePortfolio(input) {
  if (!isPlainObject(input)) {
    return ['Request body must be a JSON object'];
  }

  const errors = [];
  const { totalAssets, holdings } = input;

  if (!isFiniteNumber(totalAssets) || totalAssets <= 0) {
    errors.push('Total assets must be a number greater than 0');
  }
  if (!Array.isArray(holdings) || holdings.length === 0) {
    errors.push('Portfolio must contain at least one security');
    return errors;
  }

  const seenSymbols = new Set();
  let percentagesValid = true;

  holdings.forEach((holding, index) => {
    const row = `Row ${index + 1}`;
    if (!isPlainObject(holding)) {
      errors.push(`${row}: must be an object`);
      percentagesValid = false;
      return;
    }

    const symbol = normalizeSymbol(holding.symbol);
    if (!symbol) {
      errors.push(`${row}: symbol is required`);
    } else if (seenSymbols.has(symbol)) {
      errors.push(`${row}: duplicate symbol ${symbol}`);
    } else {
      seenSymbols.add(symbol);
    }

    for (const [field, label] of [['targetPct', 'target %'], ['currentPct', 'current %']]) {
      const value = holding[field];
      if (!isFiniteNumber(value) || value < 0 || value > 100) {
        errors.push(`${row}: ${label} must be a number between 0 and 100`);
        percentagesValid = false;
      }
    }

    if (!isFiniteNumber(holding.price) || holding.price <= 0) {
      errors.push(`${row}: unit price must be a number greater than 0`);
    }
  });

  // Sums are only meaningful when every percentage is a valid number.
  if (percentagesValid) {
    checkPercentSum(holdings, 'targetPct', 'Target %', errors);
    checkPercentSum(holdings, 'currentPct', 'Current %', errors);
  }

  return errors;
}

/**
 * Calculates trades for a portfolio that already passed validatePortfolio().
 */
function calculateTrades({ totalAssets, holdings }) {
  const rows = holdings.map((holding) => {
    const { targetPct, currentPct, price } = holding;

    const exactShares = ((targetPct - currentPct) * totalAssets) / 100 / price;
    const shares = Math.floor(Math.abs(exactShares) + FLOAT_EPSILON);

    let action = 'HOLD';
    if (shares > 0) {
      action = exactShares > 0 ? 'BUY' : 'SELL';
    }

    const tradeValue = round(shares * price, 2);
    const signedTradeValue = action === 'SELL' ? -tradeValue : tradeValue;
    const postTradePct = (((currentPct * totalAssets) / 100 + signedTradeValue) / totalAssets) * 100;

    return {
      symbol: normalizeSymbol(holding.symbol),
      targetPct,
      currentPct,
      variancePct: round(currentPct - targetPct, 4),
      price,
      action,
      shares,
      tradeValue,
      postTradePct: round(postTradePct, 4),
      residualVariancePct: round(postTradePct - targetPct, 4),
    };
  });

  const sumTradeValue = (action) =>
    round(
      rows.filter((row) => row.action === action).reduce((total, row) => total + row.tradeValue, 0),
      2,
    );
  const totalBuyValue = sumTradeValue('BUY');
  const totalSellValue = sumTradeValue('SELL');

  return {
    holdings: rows,
    summary: {
      totalAssets,
      totalBuyValue,
      totalSellValue,
      // positive: cash left over, negative: sells do not cover the buys
      netCashFlow: round(totalSellValue - totalBuyValue, 2),
    },
  };
}

function rebalance(input) {
  const errors = validatePortfolio(input);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, result: calculateTrades(input) };
}

module.exports = { rebalance, validatePortfolio, calculateTrades };
