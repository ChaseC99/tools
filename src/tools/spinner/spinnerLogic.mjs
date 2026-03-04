const EXTRA_TURN_MIN = 5;
const EXTRA_TURN_MAX = 8;

const normalizeDegrees = (deg) => ((deg % 360) + 360) % 360;

export function parseOptions(inputText) {
  return inputText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function getSecureRandomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive must be a positive integer");
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    return randomValues[0] % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

export function chooseWinnerIndex(optionCount, randomInt = getSecureRandomInt) {
  if (!Number.isInteger(optionCount) || optionCount < 2) {
    throw new Error("optionCount must be at least 2");
  }

  return randomInt(optionCount);
}

export function chooseExtraTurns(randomInt = getSecureRandomInt) {
  const span = EXTRA_TURN_MAX - EXTRA_TURN_MIN + 1;
  return EXTRA_TURN_MIN + randomInt(span);
}

export function computeTargetRotation({ currentRotation, winnerIndex, optionCount, extraTurns }) {
  if (!Number.isInteger(optionCount) || optionCount < 2) {
    throw new Error("optionCount must be at least 2");
  }
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= optionCount) {
    throw new Error("winnerIndex out of range");
  }
  if (!Number.isInteger(extraTurns) || extraTurns < 0) {
    throw new Error("extraTurns must be a non-negative integer");
  }

  const sliceAngle = 360 / optionCount;
  const winnerCenterDeg = winnerIndex * sliceAngle + sliceAngle / 2;
  const desiredNormalized = normalizeDegrees(360 - winnerCenterDeg);
  const currentNormalized = normalizeDegrees(currentRotation);
  const deltaToTarget = normalizeDegrees(desiredNormalized - currentNormalized);

  return currentRotation + extraTurns * 360 + deltaToTarget;
}

export function removeOptionAtIndex(inputText, targetIndex) {
  const options = parseOptions(inputText);
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= options.length) {
    return options.join("\n");
  }

  options.splice(targetIndex, 1);
  return options.join("\n");
}
