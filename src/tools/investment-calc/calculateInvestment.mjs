/** @typedef {"monthly"|"yearly"} ContributionFrequency */
/** @typedef {"beginning"|"end"} ContributionTiming */

/**
 * @typedef {Object} InvestmentInput
 * @property {number} principal
 * @property {number} annualRatePct
 * @property {number} years
 * @property {number} contribution
 * @property {ContributionFrequency} contributionFrequency
 * @property {ContributionTiming} contributionTiming
 */

/**
 * @typedef {Object} InvestmentRow
 * @property {number} year
 * @property {number} starting
 * @property {number} contributions
 * @property {number} interest
 * @property {number} ending
 */

/**
 * @typedef {Object} InvestmentResult
 * @property {InvestmentRow[]} rows
 * @property {number} finalBalance
 * @property {number} totalContributions
 * @property {number} totalInterest
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Period-based compounding with configurable contribution cadence and timing.
 * @param {InvestmentInput} input
 * @returns {InvestmentResult}
 */
export function calculateInvestment(input) {
  const principal = clamp(Number.isFinite(input.principal) ? input.principal : 0, 0, Number.MAX_SAFE_INTEGER);
  const annualRatePct = clamp(Number.isFinite(input.annualRatePct) ? input.annualRatePct : 0, 0, 100);
  const years = clamp(Math.trunc(Number.isFinite(input.years) ? input.years : 0), 1, 100);
  const contribution = clamp(Number.isFinite(input.contribution) ? input.contribution : 0, 0, Number.MAX_SAFE_INTEGER);

  const periodsPerYear = input.contributionFrequency === "monthly" ? 12 : 1;
  const contributionPerPeriod = contribution;
  const annualRateDecimal = annualRatePct / 100;
  // Treat annualRatePct as an effective annual return.
  const periodRate = Math.pow(1 + annualRateDecimal, 1 / periodsPerYear) - 1;

  /** @type {InvestmentRow[]} */
  const rows = [];
  let balance = principal;

  for (let year = 1; year <= years; year += 1) {
    const starting = balance;
    let yearContributions = 0;
    let yearInterest = 0;

    for (let period = 0; period < periodsPerYear; period += 1) {
      if (input.contributionTiming === "beginning") {
        balance += contributionPerPeriod;
        yearContributions += contributionPerPeriod;
      }

      const interest = balance * periodRate;
      balance += interest;
      yearInterest += interest;

      if (input.contributionTiming === "end") {
        balance += contributionPerPeriod;
        yearContributions += contributionPerPeriod;
      }
    }

    rows.push({
      year,
      starting,
      contributions: yearContributions,
      interest: yearInterest,
      ending: balance,
    });
  }

  const totalContributions = principal + rows.reduce((sum, row) => sum + row.contributions, 0);
  const finalBalance = balance;

  return {
    rows,
    finalBalance,
    totalContributions,
    totalInterest: finalBalance - totalContributions,
  };
}
