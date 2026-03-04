import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOptions,
  chooseWinnerIndex,
  computeTargetRotation,
  removeOptionAtIndex,
  chooseExtraTurns,
} from "./spinnerLogic.mjs";

const normalizeDegrees = (deg) => ((deg % 360) + 360) % 360;

test("parseOptions trims lines, removes blanks, and preserves duplicates/order", () => {
  const parsed = parseOptions("  apple\n\nbanana\n apple \n   \ncherry\n");
  assert.deepEqual(parsed, ["apple", "banana", "apple", "cherry"]);
});

test("chooseWinnerIndex delegates to random source and respects bounds", () => {
  const winner = chooseWinnerIndex(4, () => 2);
  assert.equal(winner, 2);
});

test("chooseExtraTurns returns configured turn range", () => {
  assert.equal(chooseExtraTurns(() => 0), 5);
  assert.equal(chooseExtraTurns(() => 3), 8);
});

test("removeOptionAtIndex removes only the selected duplicate occurrence", () => {
  const input = "apple\nbanana\napple\ncherry";
  const updated = removeOptionAtIndex(input, 2);
  assert.equal(updated, "apple\nbanana\ncherry");
});

test("computeTargetRotation aligns selected slice center with pointer", () => {
  const optionCount = 6;
  const winnerIndex = 4;
  const currentRotation = 17;
  const finalRotation = computeTargetRotation({
    currentRotation,
    winnerIndex,
    optionCount,
    extraTurns: 6,
  });

  const sliceAngle = 360 / optionCount;
  const winnerCenter = winnerIndex * sliceAngle + sliceAngle / 2;
  const finalWinnerPosition = normalizeDegrees(winnerCenter + finalRotation);

  assert.ok(Math.abs(finalWinnerPosition - 0) < 1e-9 || Math.abs(finalWinnerPosition - 360) < 1e-9);
  assert.ok(finalRotation > currentRotation);
});
