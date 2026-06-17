import { describe, expect, it } from 'vitest';

import { calcAddPosition, calcReducePosition } from './positionCalc';

describe('calcAddPosition', () => {
  it('computes weighted average cost using explicit current price', () => {
    const result = calcAddPosition({
      shares: 1000,
      avgCost: 10,
      currentPrice: 9.5,
      tradePrice: 8,
      tradeShares: 500
    });

    expect(result).not.toBeNull();
    expect(result!.newShares).toBe(1500);
    expect(result!.newAvgCost).toBeCloseTo(9.333333, 5);
    expect(result!.newPnlPct).toBeCloseTo(1.785714, 5);
  });
});

describe('calcReducePosition', () => {
  it('keeps average cost and computes remaining shares with explicit current price', () => {
    const result = calcReducePosition({
      shares: 1000,
      avgCost: 10,
      currentPrice: 12.5,
      tradePrice: 13,
      tradeShares: 300
    });

    expect(result).not.toBeNull();
    expect(result!.newShares).toBe(700);
    expect(result!.newAvgCost).toBe(10);
    expect(result!.newPnlPct).toBeCloseTo(25);
    expect(result!.realizedPnl).toBeCloseTo(900);
  });

  it('returns null when selling all shares', () => {
    expect(
      calcReducePosition({
        shares: 100,
        avgCost: 10,
        currentPrice: 11,
        tradePrice: 11,
        tradeShares: 100
      })
    ).toBeNull();
  });
});
