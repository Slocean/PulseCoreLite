export interface PositionCalcInput {
  shares: number;
  avgCost: number;
  currentPrice: number;
  tradePrice: number;
  tradeShares: number;
}

export interface PositionCalcResult {
  newShares: number;
  newAvgCost: number;
  newPnlPct: number;
  oldTotalCost: number;
  newTotalCost: number;
  realizedPnl?: number;
}

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

export function calcAddPosition(input: PositionCalcInput): PositionCalcResult | null {
  const { shares, avgCost, currentPrice, tradePrice, tradeShares } = input;
  if (
    !isPositive(shares) ||
    !isPositive(avgCost) ||
    !isPositive(currentPrice) ||
    !isPositive(tradePrice) ||
    !isPositive(tradeShares)
  ) {
    return null;
  }

  const oldTotalCost = shares * avgCost;
  const newShares = shares + tradeShares;
  const newTotalCost = oldTotalCost + tradeShares * tradePrice;
  const newAvgCost = newTotalCost / newShares;
  const newPnlPct = ((currentPrice - newAvgCost) / newAvgCost) * 100;

  return {
    newShares,
    newAvgCost,
    newPnlPct,
    oldTotalCost,
    newTotalCost
  };
}

export function calcReducePosition(input: PositionCalcInput): PositionCalcResult | null {
  const { shares, avgCost, currentPrice, tradePrice, tradeShares } = input;
  if (
    !isPositive(shares) ||
    !isPositive(avgCost) ||
    !isPositive(currentPrice) ||
    !isPositive(tradePrice) ||
    !isPositive(tradeShares) ||
    tradeShares >= shares
  ) {
    return null;
  }

  const newShares = shares - tradeShares;
  const newAvgCost = avgCost;
  const oldTotalCost = shares * avgCost;
  const newTotalCost = newShares * newAvgCost;
  const newPnlPct = ((currentPrice - newAvgCost) / newAvgCost) * 100;
  const realizedPnl = tradeShares * (tradePrice - avgCost);

  return {
    newShares,
    newAvgCost,
    newPnlPct,
    oldTotalCost,
    newTotalCost,
    realizedPnl
  };
}
