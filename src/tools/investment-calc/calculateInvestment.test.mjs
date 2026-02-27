import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvestment } from './calculateInvestment.mjs';

const closeTo = (actual, expected, epsilon = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be within ${epsilon} of ${expected}`);
};

test('matches annual compounding with no contributions', () => {
  const result = calculateInvestment({
    principal: 1000,
    annualRatePct: 10,
    years: 2,
    contribution: 0,
    contributionFrequency: 'yearly',
    contributionTiming: 'end',
  });

  closeTo(result.finalBalance, 1210);
  closeTo(result.totalContributions, 1000);
  closeTo(result.totalInterest, 210);
  assert.equal(result.rows.length, 2);
});

test('monthly cadence compounds by period', () => {
  const result = calculateInvestment({
    principal: 0,
    annualRatePct: 12,
    years: 1,
    contribution: 100,
    contributionFrequency: 'monthly',
    contributionTiming: 'end',
  });

  const i = Math.pow(1 + 0.12, 1 / 12) - 1;
  const expected = 100 * ((Math.pow(1 + i, 12) - 1) / i);

  closeTo(result.totalContributions, 1200);
  closeTo(result.finalBalance, expected);
});

test('annual return remains consistent with no contributions regardless of period frequency', () => {
  const monthly = calculateInvestment({
    principal: 10000,
    annualRatePct: 7,
    years: 20,
    contribution: 0,
    contributionFrequency: 'monthly',
    contributionTiming: 'end',
  });

  const yearly = calculateInvestment({
    principal: 10000,
    annualRatePct: 7,
    years: 20,
    contribution: 0,
    contributionFrequency: 'yearly',
    contributionTiming: 'end',
  });

  closeTo(monthly.finalBalance, yearly.finalBalance);
});

test('beginning contributions earn more than end contributions', () => {
  const base = {
    principal: 10000,
    annualRatePct: 7,
    years: 20,
    contribution: 500,
    contributionFrequency: 'monthly',
  };

  const beginning = calculateInvestment({ ...base, contributionTiming: 'beginning' });
  const end = calculateInvestment({ ...base, contributionTiming: 'end' });

  assert.ok(beginning.finalBalance > end.finalBalance);
});

test('sanitizes invalid numeric inputs', () => {
  const result = calculateInvestment({
    principal: Number.NaN,
    annualRatePct: Number.NaN,
    years: Number.NaN,
    contribution: Number.NaN,
    contributionFrequency: 'monthly',
    contributionTiming: 'end',
  });

  assert.equal(result.rows.length, 1);
  closeTo(result.finalBalance, 0);
  closeTo(result.totalContributions, 0);
  closeTo(result.totalInterest, 0);
});
